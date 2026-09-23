import { notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

interface Params {
    username: string,
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

export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 解析参数
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || MAX_LIMIT, MAX_LIMIT);
    const maxId = Number(url.searchParams.get("maxId")) || undefined;

    // 只查本地数据库里的用户（限定本站，避免命中同名远程用户）
    const db = getDBClient();
    const user = (await db.select().from(users).where(
        and(
            eq(users.username, params.username),
            eq(users.domain, url.host),
        ),
    ))[0];
    if (!user) {
        return Response.json({
            error: "User not found.",
        }, {
            status: 404,
        });
    }

    // 查询该用户的帖子，没有 inReplyTo 的
    const rows = await db.select().from(notes).where(
        and(
            eq(notes.actor, user.actorUrl),
            isNull(notes.deletedAt),
            isNull(notes.inReplyTo),
            maxId ? lt(notes.id, maxId) : undefined,
        ),
    ).orderBy(desc(notes.id)).limit(limit);

    // 当前登录用户（可选），用于 liked 状态
    const viewer = await resolveRequestUser(request);

    // 组装返回
    const items: Item[] = await toNoteListItems(rows, viewer?.id);

    return Response.json({
        items,
    }, {
        status: 200,
    });
}
