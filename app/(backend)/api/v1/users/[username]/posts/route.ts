import { notes, users } from "@/src/db/schema";
import { env } from "cloudflare:workers";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

interface Params {
    username: string,
}

interface Item {
    id: number,
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
    const db = drizzle(env.DB);
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
    const repliesCountRows = rows.length > 0
        ? await db.select({ inReplyTo: notes.inReplyTo, value: count() })
            .from(notes)
            .where(inArray(notes.inReplyTo, rows.map(row => row.uri)))
            .groupBy(notes.inReplyTo)
        : [];
    const countByUri = new Map(repliesCountRows.map(row => [row.inReplyTo, row.value]));
    const data: Item[] = rows.map(row => ({
        id: row.id,
        uri: row.uri,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? "",
        domain: url.host,
        content: row.content,
        inReplyTo: row.inReplyTo,
        repliesCount: countByUri.get(row.uri) ?? 0,
        createdAt: row.createdAt,
    }));

    return Response.json({
        items: data,
    }, {
        status: 200,
    });
}
