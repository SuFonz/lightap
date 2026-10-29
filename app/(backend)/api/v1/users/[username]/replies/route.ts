import { notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

interface Params {
    username: string,
}

/**
 * 某个用户的回复列表：GET /api/v1/users/[username]/replies
 *
 * 与 /posts 的唯一区别是 `inReplyTo` 的过滤方向：
 * - posts 要 `is null`（原创帖）
 * - replies 要 `is not null`（回复）
 *
 * 分页沿用 maxId（notes.id 游标），与 /posts 完全一致，
 * 前端可以用同一套无限滚动逻辑。
 */
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || MAX_LIMIT, MAX_LIMIT);
    const maxId = Number(url.searchParams.get("maxId")) || undefined;

    // domain 省略时按本站查；带上 domain 可查远程用户，避免同名用户串到本地那位身上
    const domain = url.searchParams.get("domain") ?? url.host;

    const db = getDBClient();
    const user = (await db.select().from(users).where(
        and(
            eq(users.username, params.username),
            eq(users.domain, domain),
        ),
    ))[0];
    if (!user) {
        return Response.json({
            error: "User not found.",
        }, {
            status: 404,
        });
    }

    // 该用户发出的回复：有 inReplyTo、未删除
    const rows = await db.select().from(notes).where(
        and(
            eq(notes.actor, user.actorUrl),
            isNull(notes.deletedAt),
            isNotNull(notes.inReplyTo),
            maxId ? lt(notes.id, maxId) : undefined,
        ),
    ).orderBy(desc(notes.id)).limit(limit);

    const viewer = await resolveRequestUser(request);
    const items = await toNoteListItems(rows, viewer?.id);

    return Response.json({
        items,
    }, {
        status: 200,
    });
}
