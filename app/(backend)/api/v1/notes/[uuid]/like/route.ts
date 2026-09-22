import { buildLike } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { likes, notes } from "@/src/db/schema";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
    uuid: string,
}

/** 本站用户点赞某个 Note：POST /api/v1/notes/[uuid]/like */
export async function POST(
    request: Request,
    { params }: { params: Params },
) {
    // 解析参数
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

        // 幂等：已点过赞直接返回
        const existing = (await db.select().from(likes).where(
            and(
                eq(likes.userId, user.id),
                eq(likes.noteId, note.id),
            ),
        ))[0];
        if (existing) {
            return Response.json({}, {
                status: 200,
            });
        }

        // Like 活动与点赞记录共用一个 uri
        const like = buildLike(url, crypto.randomUUID(), user.actorUrl, note.uri);
        await db.insert(likes).values({
            uri: like.id,
            userId: user.id,
            noteId: note.id,
        });

        // 记录 Like 活动，远程作者异步投递（本地作者走本地数据库，不投递）
        await dispatchActivity(url, {
            uri: like.id,
            type: "Like",
            actor: user.actorUrl,
            objectUri: note.uri,
            targets: note.actor.startsWith(`${url.origin}/users/`) ? [] : [note.actor],
        });
    } catch (error: any) {
        console.log(error.message);
        return Response.json({
            error: "Server internal error.",
        }, {
            status: 500,
        });
    }

    return Response.json({}, {
        status: 200,
    });
}

/** 本站用户取消点赞：DELETE /api/v1/notes/[uuid]/like */
export async function DELETE(
    request: Request,
    { params }: { params: Params },
) {
    // 解析参数
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

        // 幂等：没点过赞直接返回
        const existing = (await db.select().from(likes).where(
            and(
                eq(likes.userId, user.id),
                eq(likes.noteId, note.id),
            ),
        ))[0];
        if (!existing) {
            return Response.json({}, {
                status: 200,
            });
        }

        // 删除点赞记录
        await db.delete(likes).where(eq(likes.id, existing.id));

        // Undo Like：object 是之前那条 Like 活动（本地作者走本地数据库，不投递）
        await dispatchActivity(url, {
            type: "Undo",
            actor: user.actorUrl,
            objectUri: existing.uri,
            targets: note.actor.startsWith(`${url.origin}/users/`) ? [] : [note.actor],
        });
    } catch (error: any) {
        console.log(error.message);
        return Response.json({
            error: "Server internal error.",
        }, {
            status: 500,
        });
    }

    return Response.json({}, {
        status: 200,
    });
}
