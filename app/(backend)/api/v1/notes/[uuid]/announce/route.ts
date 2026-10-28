import { buildAnnounce } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { announces, follows, notes, users } from "@/src/db/schema";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { createNotification } from "@/src/lib/notify";
import { publishEvent } from "@/src/realtime/sse";
import { and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** D1 单条 SQL 的绑定参数上限是 100，批量查询时按这个粒度分批 */
const BOUND_PARAMS_PER_QUERY = 90;

interface Params {
    uuid: string,
}

interface Body {
    /** 取消转发时可选：指定要撤销的 announce uri（远程转发用） */
    announceUri?: string,
}

/**
 * 转发（Announce）：POST /api/v1/notes/[uuid]/announce
 *
 * 语义与 Mastodon 的 boost / Misskey 的 renote 一致：
 * - 原帖内容不复制，只记一条「谁转了哪条」
 * - 同一个人对同一条帖子只能转一次（数据库唯一约束保证幂等）
 * - 转发后会出现在时间线上（由 feed 接口合并返回）
 */
export async function POST(
    request: Request,
    { params }: { params: Params },
) {
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

        const note = (await db.select().from(notes).where(eq(notes.uuid, params.uuid)))[0];
        if (!note) {
            return Response.json({
                error: "Note not found.",
            }, {
                status: 404,
            });
        }

        // 已删除的帖子不允许转发
        if (note.deletedAt) {
            return Response.json({
                error: "Note not found.",
            }, {
                status: 404,
            });
        }

        // 幂等：已转发过直接返回当前状态
        const existing = (await db.select().from(announces).where(
            and(
                eq(announces.userId, user.id),
                eq(announces.noteId, note.id),
            ),
        ))[0];
        if (existing) {
            return Response.json({
                announced: true,
                announceUri: existing.uri,
            }, {
                status: 200,
            });
        }

        // Announce 活动的 uri 与转发记录共用
        const announce = buildAnnounce({
            url,
            uuid: crypto.randomUUID(),
            actor: user.actorUrl,
            object: note.uri,
        });

        const inserted = (await db.insert(announces).values({
            uri: announce.id,
            userId: user.id,
            noteId: note.id,
        }).returning())[0];

        // 通知被转发的帖子作者（仅本站用户，自己转自己不通知）
        const recipient = (await db.select().from(users).where(eq(users.actorUrl, note.actor)))[0];
        if (recipient && recipient.domain === url.host) {
            await createNotification({
                userId: recipient.id,
                actorId: user.id,
                type: "Announce",
                noteId: note.id,
            });
        }

        // 记录 Announce 活动并异步投递：关注者 + 原帖作者（远程）
        const followerActorUrls = (await db.select({ follower: follows.follower })
            .from(follows).where(eq(follows.following, user.actorUrl)))
            .map(f => f.follower);

        const targets = new Set<string>(followerActorUrls);
        // 原帖作者是远程时也要投递（对方需要知道被转发了）
        if (!note.actor.startsWith(`${url.origin}/users/`)) {
            targets.add(note.actor);
        }
        // 本地用户走本地数据库，不投递
        const remoteTargets = [...targets].filter(
            actorUrl => !actorUrl.startsWith(`${url.origin}/users/`),
        );

        await dispatchActivity(url, {
            uri: announce.id,
            type: "Announce",
            actor: user.actorUrl,
            objectUri: note.uri,
            targets: remoteTargets,
        });

        // 实时推送：组装一条带 announcedBy 的列表项
        try {
            const [item] = await toNoteListItems(
                [note],
                undefined,
                new Map([[note.id, {
                    username: user.username,
                    displayName: user.displayName ?? user.username,
                    avatarUrl: user.avatarUrl ?? "",
                    domain: user.domain,
                    announceUri: announce.id,
                }]]),
            );
            if (item) {
                // 「全部 / 本地」：广播
                await publishEvent({
                    type: "announce.created",
                    data: item,
                }, { type: "all" });

                // 「已关注」：定向推给关注了转发者的本站用户
                if (followerActorUrls.length > 0) {
                    const userIds: number[] = [];
                    for (let i = 0; i < followerActorUrls.length; i += BOUND_PARAMS_PER_QUERY) {
                        const chunk = followerActorUrls.slice(i, i + BOUND_PARAMS_PER_QUERY);
                        const localFollowers = await db.select({ id: users.id }).from(users).where(
                            and(
                                inArray(users.actorUrl, chunk),
                                eq(users.domain, url.host),
                            ),
                        );
                        userIds.push(...localFollowers.map(u => u.id));
                    }
                    if (userIds.length > 0) {
                        await publishEvent({
                            type: "following.announce",
                            data: item,
                        }, { type: "users", userIds });
                    }
                }
            }
        } catch {
            // 实时推送失败不影响转发本身
        }

        return Response.json({
            announced: true,
            announceUri: announce.id,
            announceCount: 0,
            id: inserted.id,
        }, {
            status: 200,
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

/** 取消转发：DELETE /api/v1/notes/[uuid]/announce */
export async function DELETE(
    request: Request,
    { params }: { params: Params },
) {
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

        const note = (await db.select().from(notes).where(eq(notes.uuid, params.uuid)))[0];
        if (!note) {
            return Response.json({
                error: "Note not found.",
            }, {
                status: 404,
            });
        }

        // 幂等：没转发过直接返回
        const existing = (await db.select().from(announces).where(
            and(
                eq(announces.userId, user.id),
                eq(announces.noteId, note.id),
            ),
        ))[0];
        if (!existing) {
            return Response.json({
                announced: false,
            }, {
                status: 200,
            });
        }

        await db.delete(announces).where(eq(announces.id, existing.id));

        // Undo Announce：object 是之前那条 Announce 活动
        const followerActorUrls = (await db.select({ follower: follows.follower })
            .from(follows).where(eq(follows.following, user.actorUrl)))
            .map(f => f.follower);

        const targets = new Set<string>(followerActorUrls);
        if (!note.actor.startsWith(`${url.origin}/users/`)) {
            targets.add(note.actor);
        }
        const remoteTargets = [...targets].filter(
            actorUrl => !actorUrl.startsWith(`${url.origin}/users/`),
        );

        await dispatchActivity(url, {
            type: "Undo",
            actor: user.actorUrl,
            objectUri: existing.uri,
            targets: remoteTargets,
        });

        // 实时通知客户端撤掉这条转发
        try {
            await publishEvent({
                type: "announce.removed",
                data: { noteUuid: note.uuid, actorUsername: user.username },
            }, { type: "all" });
        } catch {
            // 推送失败不影响取关
        }

        return Response.json({
            announced: false,
        }, {
            status: 200,
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
