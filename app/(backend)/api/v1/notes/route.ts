import { buildNote } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { follows, notes, users } from "@/src/db/schema";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { createNotification } from "@/src/lib/notify";
import { publishEvent } from "@/src/realtime/sse";
import { and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Item {
    id: number,
    uuid: string,
    uri: string,
    content: string,
    liked: boolean,
    likeCount: number,
}

interface Body {
    content: string,
    inReplyTo?: string,
}

export async function POST(request: Request) {
    // 解析参数
    const url = new URL(request.url);
    const body = await request.json<Body>();

    let data: Item;

    try {
        const db = getDBClient();
        const user = await resolveRequestUser(request);
        if (!user) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 401,
            });
        }

        // Note 存到数据库
        const uuid = crypto.randomUUID();
        const note = buildNote({
            url,
            uuid,
            content: body.content,
            inReplyTo: body.inReplyTo,
        });
        const dbNote = (await db.insert(notes).values({
            uri: note.id,
            uuid: uuid,
            actor: user.actorUrl,
            content: body.content,
            inReplyTo: body.inReplyTo ?? null,
        }).returning())[0];

        // 递送目标：关注者 + 被回复者（本地实例的用户直接跳过，他们走本地数据库）
        const followerActorUrls = (await db.select().from(follows).where(eq(follows.following, user.actorUrl))).map(f => f.follower);
        const inboxes = new Set(followerActorUrls);
        if (body.inReplyTo) {
            const reply = (await db.select().from(notes).where(eq(notes.uri, body.inReplyTo)))[0];
            if (reply) {
                inboxes.add(reply.actor);

                // 回复的是本站用户 → 给对方写一条 Reply 通知（自己回复自己不发）
                const recipient = (await db.select().from(users).where(eq(users.actorUrl, reply.actor)))[0];
                if (recipient && recipient.domain === url.host) {
                    await createNotification({
                        userId: recipient.id,
                        actorId: user.id,
                        type: "Reply",
                        noteId: dbNote.id,
                    });
                }

                // 回复不广播到时间线，只让前端把父帖的评论数 +1
                try {
                    await publishEvent({
                        type: "reply.created",
                        data: { parentUuid: reply.uuid, actorUsername: user.username },
                    }, { type: "all" });
                } catch {
                    // 实时推送失败不影响回复
                }
            }
        }
        const targets = [...inboxes].filter(actorUrl => !actorUrl.startsWith(`${url.origin}/users/`));

        // 记录 Create Activity 并丢进队列异步投递
        await dispatchActivity(url, {
            type: "Create",
            actor: user.actorUrl,
            objectId: dbNote.id,
            objectType: "Note",
            targets,
        });

        // 顶层帖才广播到时间线（回复只走上面的 reply.created，不进时间线）
        if (!body.inReplyTo) {
            try {
                const [item] = await toNoteListItems([dbNote], user.id);
                if (item) {
                    // 「全部 / 本地」：广播给所有人（含访客）
                    await publishEvent({ type: "note.created", data: item }, { type: "all" });

                    // 「已关注」：定向推给关注了作者的本站用户
                    if (followerActorUrls.length > 0) {
                        const localFollowers = await db.select().from(users).where(
                            and(
                                inArray(users.actorUrl, followerActorUrls),
                                eq(users.domain, url.host),
                            ),
                        );
                        const userIds = localFollowers.map(u => u.id);
                        if (userIds.length > 0) {
                            await publishEvent({ type: "following.note", data: item }, { type: "users", userIds });
                        }
                    }
                }
            } catch {
                // 实时推送失败不影响发帖
            }
        }

        // 返回新建的 Note（刚发布，还没有点赞）
        data = {
            id: dbNote.id,
            uuid: dbNote.uuid,
            uri: dbNote.uri,
            content: dbNote.content,
            liked: false,
            likeCount: 0,
        };
    } catch (error: any) {
        console.log(error.message);
        return Response.json({
            error: "Server internal error.",
        }, {
            status: 500,
        });
    }

    return Response.json(data, {
        status: 200,
    })
}
