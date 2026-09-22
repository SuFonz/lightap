import { notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
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

    // 只查本地数据库里的用户
    const db = getDBClient();
    const user = (await db.select().from(users).where(eq(users.username, params.username)))[0];
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
            isNull(notes.inReplyTo),
            maxId ? lt(notes.id, maxId) : undefined,
        ),
    ).orderBy(desc(notes.id)).limit(limit);

    // 组装返回
    const items: Item[] = await toNoteListItems(rows);

    return Response.json({
        items,
    }, {
        status: 200,
    });
}
