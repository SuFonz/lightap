import { follows, notes } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, eq, isNull, sql } from "drizzle-orm";

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
    const db = getDBClient();

    // 向上追溯父 note，得到 [顶层, ..., 当前] 的线程。
    //
    // 用递归 CTE 一次查完整条父链：原来是一层一次往返（O(深度) 次），
    // 深度越大越慢，生产环境每次往返还要加上 D1 的网络开销。
    // 不存在（或已删除）时返回空数组。
    //
    // 注意：db.all() 走的是原始 SQL，不经过 drizzle 的列名映射，返回的就是
    // 查询里的列名。所以要显式 `as "createdAt"` 把 snake_case 别名回驼峰，
    // 否则下游 `row.createdAt` 取不到值（表现为详情页时间字段为空）。
    const chain = await db.all<typeof notes.$inferSelect>(sql`
        with recursive chain(
            id, uuid, uri, actor, content, inReplyTo, attachment, created_at, deleted_at, depth
        ) as (
            select id, uuid, uri, actor, content, inReplyTo, attachment, created_at, deleted_at, 0
            from ${notes}
            where uuid = ${params.uuid} and deleted_at is null
            union all
            select n.id, n.uuid, n.uri, n.actor, n.content, n.inReplyTo, n.attachment,
                   n.created_at, n.deleted_at, chain.depth + 1
            from ${notes} n
            join chain on n.uri = chain.inReplyTo
            where n.deleted_at is null
        )
        select
            id,
            uuid,
            uri,
            actor,
            content,
            inReplyTo,
            attachment,
            created_at as "createdAt",
            deleted_at as "deletedAt"
        from chain
        order by depth desc
    `);

    if (chain.length === 0) {
        return Response.json({
            error: "Note not found.",
        }, {
            status: 404,
        });
    }

    // 当前帖：链的最后一环（顶层在前）。用 uri 查直接回复，
    // 不用 params.uuid 直接拼，是为了让 replies 与链上的对象保持同一份数据。
    const current = chain[chain.length - 1];

    // 查询哪个 note 引用了当前 note
    const replies = await db.select().from(notes).where(
        and(
            eq(notes.inReplyTo, current.uri),
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

        // 软删除：只打 deletedAt 标记，不真正删行。
        //
        // 为什么不硬删：
        // - Delete 活动要向远端投递 Tombstone，原帖 uri 和行本身都还要用来构建报文
        // - 保留数据让误删可恢复，也便于排查
        // - 展示层（feed / 线程 / 转发合并 / 用户帖子）都带 `deletedAt is null` 过滤，
        //   标记后自然不再出现，效果与删除一致
        //
        // 数据库里 likes / announces / notifications 的外键带 ON DELETE CASCADE，
        // 那是给「直接在数据库里清理数据」用的，应用层不会触发。
        await db.update(notes).set({
            deletedAt: Math.floor(Date.now() / 1000),
        }).where(eq(notes.id, note.id));

        // 记录 Delete 活动并向远程收件人异步投递；object 指向 Tombstone
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
