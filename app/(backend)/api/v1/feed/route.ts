import { follows, notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { toNoteListItems } from "@/src/lib/notes";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

interface Body {
    limit?: number,
    maxId?: number,
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
    };

    const db = getDBClient();

    // 当前登录用户（可选）：关注流需要它，liked 状态也需要它
    const viewer = await resolveRequestUser(request);

    // 根据类型确定作者范围：all = 数据库全部，local = 本站用户，following = 当前用户关注的人
    let actors: string[] | null = null;
    if (type === "local") {
        // 只取本站用户，数据库以后会插入远程用户，不能直接全表取
        actors = (await db.select().from(users).where(
            eq(users.domain, url.host),
        )).map(user => user.actorUrl);
    } else if (type === "following") {
        // 关注流需要登录
        if (!viewer) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 403,
            });
        }
        // 关注流包含自己发的帖
        actors = (await db.select().from(follows).where(eq(follows.follower, viewer.actorUrl))).map(f => f.following);
        actors.push(viewer.actorUrl);
    }

    // 没有可查询的作者直接返回空
    if (actors && actors.length === 0) {
        return Response.json({
            items: [],
        }, {
            status: 200,
        });
    }

    // 根据类型查询帖子，查询没有 inReplyTo 的帖子
    const rows = await db.select().from(notes).where(
        and(
            isNull(notes.deletedAt),
            isNull(notes.inReplyTo),
            body.maxId ? lt(notes.id, body.maxId) : undefined,
            actors ? inArray(notes.actor, actors) : undefined,
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
