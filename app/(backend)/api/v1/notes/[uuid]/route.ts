import { follows, likes, notes } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, eq, isNull } from "drizzle-orm";

interface Params {
    uuid: string,
}

interface Item {
    uuid: string,
    uri: string,
    username: string,
    domain: string,
    content: string,
    inReplyTo: string | null,
    liked: boolean,
    likeCount: number,
    repliesCount: number,
    createdAt: number,
}

/**
 * TODO:
 * 目前回复的话只是查询数据库里有的，
 * 未来打算查询远程服务器的，
 * 获取远程服务器的回复之后就存到数据库
 */
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 根据当前 uuid 查询数据库
    const db = getDBClient();
    const note = (await db.select().from(notes).where(
        and(
            eq(notes.uuid, params.uuid),
            isNull(notes.deletedAt),
        ),
    ))[0];
    if (!note) {
        return Response.json({
            error: "Note not found.",
        }, {
            status: 404,
        });
    }

    // 向上追溯父 note，得到 [顶层, ..., 当前] 的线程
    const chain = [note];
    let cursor = note;
    while (cursor.inReplyTo) {
        const parent = (await db.select().from(notes).where(
            and(
                eq(notes.uri, cursor.inReplyTo),
                isNull(notes.deletedAt),
            ),
        ))[0];
        if (!parent) {
            break;
        }
        chain.unshift(parent);
        cursor = parent;
    }

    // 查询哪个 note 引用了当前 note
    const replies = await db.select().from(notes).where(
        and(
            eq(notes.inReplyTo, note.uri),
            isNull(notes.deletedAt),
        ),
    );

    // 当前登录用户（可选），用于 liked 状态
    const viewer = await resolveRequestUser(request);

    // 组装返回
    const items: Item[] = await toNoteListItems([...chain, ...replies], viewer?.id);

    // 返回
    return Response.json({
        chain: items.slice(0, chain.length),
        replies: items.slice(chain.length),
    }, {
        status: 200,
    });
}

// TODO: 可能会考虑只做标记，而不是真正删除
/** 删除帖子：DELETE /api/v1/notes/[uuid]，只有作者本人能删 */
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

        // 只能删自己的帖子
        if (note.actor !== user.actorUrl) {
            return Response.json({
                error: "Forbidden.",
            }, {
                status: 403,
            });
        }

        // 已经删过了（幂等）
        if (note.deletedAt) {
            return Response.json({}, {
                status: 200,
            });
        }

        // 先删点赞（likes.note_id 外键指向 notes，必须先清）
        await db.delete(likes).where(eq(likes.noteId, note.id));

        // 递送目标：关注者 + 被回复者（本地实例跳过，他们走本地数据库）
        const inboxes = new Set(
            (await db.select().from(follows).where(eq(follows.following, user.actorUrl))).map(f => f.follower)
        );
        if (note.inReplyTo) {
            const parent = (await db.select().from(notes).where(eq(notes.uri, note.inReplyTo)))[0];
            if (parent) {
                inboxes.add(parent.actor);
            }
        }
        const targets = [...inboxes].filter(actorUrl => !actorUrl.startsWith(`${url.origin}/users/`));

        // 软删除：只打删除时间标记，保留 uri（Delete 活动要用它指向 Tombstone）
        await db.update(notes).set({
            deletedAt: Math.floor(Date.now() / 1000),
        }).where(eq(notes.id, note.id));

        // 记录 Delete 活动并向远程收件人异步投递；object 指向 Tombstone（用 note.id 反查 uri）
        await dispatchActivity(url, {
            type: "Delete",
            actor: user.actorUrl,
            objectId: note.id,
            objectType: "Tombstone",
            targets,
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
