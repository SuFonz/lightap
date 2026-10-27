import { follows, notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, desc, eq, gt, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

interface Body {
    limit?: number,
    /** 向下翻页：取 id 小于它的 */
    maxId?: number,
    /** 向上补漏：取 id 大于它的（用于 SSE 断线重连后补齐） */
    sinceId?: number,
}

interface Item {
    id: number,
    uuid: string,
    uri: string,
    username: string,
    displayName: string,
    avatarUrl: string,
    domain: string,
    content: string,
    inReplyTo: string | null,
    liked: boolean,
    likeCount: number,
    repliesCount: number,
    createdAt: number,
}

export async function GET(request: Request) {
    // 解析参数
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const body: Body = {
        limit: Math.min(Number(url.searchParams.get("limit")) || MAX_LIMIT, MAX_LIMIT),
        maxId: Number(url.searchParams.get("maxId")) || undefined,
        sinceId: Number(url.searchParams.get("sinceId")) || undefined,
    };

    const db = getDBClient();

    // 当前登录用户（可选）：关注流需要它，liked 状态也需要它
    const viewer = await resolveRequestUser(request);

    // 作者范围用「子查询」表达，而不是把作者列表拉回来再 inArray。
    //
    // 原因：D1 单条 SQL 的绑定参数上限是 100 个。本地用户数 / 关注数超过这个量级时，
    // 原来的 `inArray(notes.actor, actors)` 会直接报错（不是变慢，是失败）。
    // 用子查询后绑定参数恒定，且作者集合的过滤在库内完成，不需要把名单传回 Worker。
    let authorScope: SQL | undefined;
    if (type === "local") {
        // 本站用户：数据库里有远程用户，不能全表取
        authorScope = inArray(
            notes.actor,
            db.select({ actorUrl: users.actorUrl }).from(users).where(eq(users.domain, url.host)),
        );
    } else if (type === "following") {
        // 关注流需要登录
        if (!viewer) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 403,
            });
        }
        // 关注流包含自己发的帖：子查询里用 union 把自己并进作者集合，
        // 这样绑定参数只有 actorUrl 一个，不随关注数增长。
        authorScope = inArray(
            notes.actor,
            sql`(select ${follows.following} from ${follows} where ${follows.follower} = ${viewer.actorUrl} union select ${viewer.actorUrl})`,
        );
    }

    // 根据类型查询帖子，查询没有 inReplyTo 的帖子
    const rows = await db.select().from(notes).where(
        and(
            isNull(notes.deletedAt),
            isNull(notes.inReplyTo),
            body.maxId ? lt(notes.id, body.maxId) : undefined,
            body.sinceId ? gt(notes.id, body.sinceId) : undefined,
            authorScope,
        ),
    ).orderBy(desc(notes.id)).limit(body.limit ?? MAX_LIMIT);

    // 组装返回
    const items: Item[] = await toNoteListItems(rows, viewer?.id);

    return Response.json({
        items,
    }, {
        status: 200,
    });
}
