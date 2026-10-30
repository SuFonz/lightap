import { getDBClient } from "@/src/db";
import { follows, notes, users } from "@/src/db/schema";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { clearSessionCookieValues, cookieHeaders } from "@/src/lib/cookies";
import { eq, inArray, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Body {
    displayName?: string;
    /** 简介（对应 users.summary） */
    bio?: string;
}

const MAX_DISPLAY_NAME = 20;
const MAX_BIO = 160;

/**
 * 更新当前登录用户的资料：PATCH /api/v1/me
 *
 * 只更新请求体里出现的字段（部分更新）。Actor 端点是用这张表拼的，
 * 所以改完远程抓取 `/users/[username]` 也会跟着变。
 */
export async function PATCH(request: Request) {
    const user = await resolveRequestUser(request);
    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 401,
        });
    }

    const body = await request.json<Body>().catch(() => ({} as Body));
    const patch: Partial<typeof users.$inferInsert> = {};

    // 昵称：给了就必须非空
    if (body.displayName !== undefined) {
        if (typeof body.displayName !== "string") {
            return Response.json({ error: "Invalid display name." }, { status: 400 });
        }
        const displayName = body.displayName.trim();
        if (!displayName) {
            return Response.json({ error: "Display name cannot be empty." }, { status: 400 });
        }
        if (displayName.length > MAX_DISPLAY_NAME) {
            return Response.json({ error: `Display name must be at most ${MAX_DISPLAY_NAME} characters.` }, { status: 400 });
        }
        patch.displayName = displayName;
    }

    // 简介：空字符串表示清空（存 null）
    if (body.bio !== undefined) {
        if (typeof body.bio !== "string") {
            return Response.json({ error: "Invalid bio." }, { status: 400 });
        }
        const bio = body.bio.trim();
        if (bio.length > MAX_BIO) {
            return Response.json({ error: `Bio must be at most ${MAX_BIO} characters.` }, { status: 400 });
        }
        patch.summary = bio || null;
    }

    if (Object.keys(patch).length === 0) {
        return Response.json({ error: "No fields to update." }, { status: 400 });
    }

    const db = getDBClient();
    await db.update(users).set({
        ...patch,
        updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(users.id, user.id));

    return Response.json({
        displayName: patch.displayName ?? user.displayName ?? "",
        bio: patch.summary !== undefined ? (patch.summary ?? "") : (user.summary ?? ""),
    }, {
        status: 200,
    });
}

/**
 * 注销账号：DELETE /api/v1/me
 *
 * 这是**硬删除**：账号及其所有内容真正从数据库移除，不可恢复。
 *
 * 执行顺序很关键：
 * 1. 先投递 Delete 活动（数据还在时才能构建正确的报文）
 * 2. 再删数据
 *
 * 为什么必须先投递：投递是异步的（写进 `activities` 表后由队列消费），
 * 队列要用活动里记录的 `objectUri` 构建 Tombstone。
 * 如果先删数据，队列消费时就拿不到原帖 uri，远端收不到有效通知。
 * 所以这里投递时一律传 `objectUri`（而不是 objectId），不依赖反查数据库。
 *
 * 删除范围：
 * - 自己发的帖子（likes / announces / notifications 靠 notes 的 CASCADE 自动清）
 * - 关注关系（双向）：`follows` 表没有外键，必须手动删
 * - 用户行：likes / announces / notifications 的 `user_id` 是 CASCADE，
 *   会自动清掉这个用户对别人内容的互动
 */
export async function DELETE(request: Request) {
    const url = new URL(request.url);
    const db = getDBClient();

    try {
        const user = await resolveRequestUser(request);
        if (!user) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 401,
            });
        }

        // ── 1. 收集投递目标 ──────────────────────────────────
        //
        // 关注者 + 回复过我的人：他们需要知道这个账号消失了。
        // 本地实例的用户跳过（他们走本地数据库，不需要联邦投递）。
        const followerActorUrls = (await db.select({ follower: follows.follower })
            .from(follows).where(eq(follows.following, user.actorUrl)))
            .map(f => f.follower);

        const targets = new Set<string>(followerActorUrls);

        const ownNotes = await db.select({
            id: notes.id,
            uri: notes.uri,
        }).from(notes).where(eq(notes.actor, user.actorUrl));

        if (ownNotes.length > 0) {
            const replyActors = (await db.select({ actor: notes.actor })
                .from(notes)
                .where(inArray(notes.inReplyTo, ownNotes.map(n => n.uri))))
                .map(r => r.actor);
            for (const actor of replyActors) targets.add(actor);
        }

        const remoteTargets = [...targets].filter(
            actorUrl => !actorUrl.startsWith(`${url.origin}/users/`),
        );

        // ── 2. 投递 Delete ──────────────────────────────────
        //
        // 先投「账号注销」（object 指向 Actor 自身），再逐条投帖子删除。
        // 两者都用 objectUri：下面马上要删数据，队列不能再反查。
        await dispatchActivity(url, {
            type: "Delete",
            actor: user.actorUrl,
            objectUri: user.actorUrl,
            objectType: "Tombstone",
            targets: remoteTargets,
        });

        for (const note of ownNotes) {
            await dispatchActivity(url, {
                type: "Delete",
                actor: user.actorUrl,
                objectUri: note.uri,
                objectType: "Tombstone",
                targets: remoteTargets,
            });
        }

        // ── 3. 删数据（顺序不能反）──────────────────────────
        await db.batch([
            // 自己发的帖子：关联的点赞 / 转发 / 通知靠 CASCADE 清理
            db.delete(notes).where(eq(notes.actor, user.actorUrl)),
            // 关注关系：follows 没有外键，必须手动删（双向）
            db.delete(follows).where(
                or(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, user.actorUrl),
                ),
            ),
            // 用户行：剩余关联数据靠 CASCADE
            db.delete(users).where(eq(users.id, user.id)),
        ]);

        // ── 4. 清登录 cookie ────────────────────────────────
        return new Response(null, {
            status: 200,
            headers: cookieHeaders(clearSessionCookieValues()),
        });
    } catch (error: any) {
        console.log(error.message);
        return Response.json({
            error: "Server internal error.",
        }, {
            status: 500,
        });
    }
}
