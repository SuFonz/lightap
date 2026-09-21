import { follows, notes, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, desc, eq, inArray, isNull, like, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

type DBUser = typeof users.$inferSelect;

type UserPayload = JwtPayload & {
    username: string,
}

interface Body {
    limit?: number,
    maxId?: number,
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

    const db = drizzle(env.DB);

    // 根据类型确定作者范围：all = 数据库全部，local = 本站用户，following = 当前用户关注的人
    let actors: string[] | null = null;
    if (type === "local") {
        // 只取本站用户，数据库以后会插入远程用户，不能直接全表取
        actors = (await db.select().from(users).where(
            like(users.actorUrl, `${url.origin}/users/%`),
        )).map(user => user.actorUrl);
    } else if (type === "following") {
        // 关注流需要登录
        let user: DBUser | null = null;
        const auth = request.headers.get("Authorization");
        if (auth) {
            const [scheme, token] = auth.split(" ");
            if (scheme === "Bearer" && token && await verifyJwt(token, env.JWT_SECRET)) {
                const payload = decodeJwt<UserPayload>(token);
                if (payload?.username) {
                    user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];
                }
            }
        }
        if (!user) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 403,
            });
        }
        // 关注流包含自己发的帖
        actors = (await db.select().from(follows).where(eq(follows.follower, user.actorUrl))).map(f => f.following);
        actors.push(user.actorUrl);
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
            isNull(notes.inReplyTo),
            body.maxId ? lt(notes.id, body.maxId) : undefined,
            actors ? inArray(notes.actor, actors) : undefined,
        ),
    ).orderBy(desc(notes.id)).limit(body.limit ?? MAX_LIMIT);

    // 组装返回
    const authors = rows.length > 0
        ? await db.select().from(users).where(inArray(users.actorUrl, rows.map(row => row.actor)))
        : [];
    const userByActor = new Map(authors.map(user => [user.actorUrl, user]));
    const data: Item[] = rows.map(row => {
        const author = userByActor.get(row.actor);
        return {
            id: row.id,
            uri: row.uri,
            username: author?.username ?? "",
            displayName: author?.displayName ?? "",
            avatarUrl: author?.avatarUrl ?? "",
            domain: url.host,
            content: row.content,
            inReplyTo: row.inReplyTo,
            createdAt: row.createdAt,
        };
    });

    return Response.json({
        items: data,
    }, {
        status: 200,
    });

}
