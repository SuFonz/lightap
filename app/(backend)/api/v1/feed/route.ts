import { announces, follows, notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems, type AnnouncedBy } from "@/src/lib/notes";
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
    /** 被转发次数 */
    announceCount: number,
    /** 非空表示这条在时间线里是「某人转发了它」 */
    announcedBy: AnnouncedBy | null,
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

    // ── 合并转发 ──────────────────────────────────────────────
    //
    // 时间线除了原始帖，还要能出现「某人转发了它」。
    // 做法：查一批转发记录，把被转发的原帖取出来，替换掉「原帖自己的那条」，
    // 并按转发时间重新排序。
    //
    // 取舍说明：没有用 SQL union 把两类条目拼成一条语句，因为两者的排序键
    // （notes.id / announces.created_at）不同，union 后还要再排一次，
    // 反而多一次 TEMP B-TREE 排序；分成两次查询再在内存合并更直观，数量也可控。
    const announceRows = await loadAnnounces(db, body, type, viewer?.actorUrl, url.host);
    if (announceRows.length > 0) {
        mergeAnnounces(items, announceRows);
    }

    return Response.json({
        items,
    }, {
        status: 200,
    });
}

/**
 * 取与当前页时间范围对应的转发记录，并补上原帖与转发者信息。
 *
 * 只取「与当前页帖子集合相关」的转发：被转发的原帖必须也在这一页里，
 * 否则会出现「翻页时突然冒出一条很久以前的帖子」。
 */
async function loadAnnounces(
    db: ReturnType<typeof getDBClient>,
    body: Body,
    type: string | null,
    viewerActorUrl: string | undefined,
    host: string,
): Promise<{ noteId: number; announceUri: string; announcedBy: AnnouncedBy }[]> {
    // 时间范围：用 notes.id 作为近似游标（转发与帖子共用同一时间轴）
    const where = and(
        body.maxId ? lt(notes.id, body.maxId) : undefined,
        body.sinceId ? gt(notes.id, body.sinceId) : undefined,
        isNull(notes.deletedAt),
        isNull(notes.inReplyTo),
        // 只看这一页的转发，避免混入旧内容
        type === "local"
            ? inArray(notes.actor, db.select({ actorUrl: users.actorUrl }).from(users).where(eq(users.domain, host)))
            : undefined,
        type === "following" && viewerActorUrl
            ? inArray(
                notes.actor,
                db.select({ following: follows.following }).from(follows).where(eq(follows.follower, viewerActorUrl)),
            )
            : undefined,
    );

    const rows = await db.select({
        noteId: announces.noteId,
        announceUri: announces.uri,
        announcerId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        domain: users.domain,
    })
        .from(announces)
        .innerJoin(notes, eq(notes.id, announces.noteId))
        .innerJoin(users, eq(users.id, announces.userId))
        .where(where)
        .orderBy(desc(announces.createdAt))
        .limit(body.limit ?? MAX_LIMIT);

    return rows.map(row => ({
        noteId: row.noteId,
        announceUri: row.announceUri,
        announcedBy: {
            username: row.username,
            displayName: row.displayName ?? row.username,
            avatarUrl: row.avatarUrl ?? "",
            domain: row.domain,
            announceUri: row.announceUri,
        },
    }));
}

/**
 * 把转发合并进列表：把原帖那条替换成「带 announcedBy 的版本」，并按转发时间重排。
 *
 * 只处理原帖已在本页的情况（跨页的转发留在它自己的页里），
 * 这样分页游标（maxId）的语义不会被破坏。
 */
function mergeAnnounces(
    items: Item[],
    announceRows: { noteId: number; announceUri: string; announcedBy: AnnouncedBy }[],
): void {
    const byNoteId = new Map(items.map(item => [item.id, item]));
    for (const row of announceRows) {
        const target = byNoteId.get(row.noteId);
        if (!target) continue;
        // 同一条帖子被多人转发时只展示第一个（最新的那个）
        if (target.announcedBy) continue;
        target.announcedBy = row.announcedBy;
    }
    // 有转发的条目提前，保持整体按 id 倒序的相对次序
    items.sort((a, b) => {
        const aBoost = a.announcedBy ? 1 : 0;
        const bBoost = b.announcedBy ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return b.id - a.id;
    });
}
