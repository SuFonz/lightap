import { APActor, APWebfinger } from "@/src/activitypub/ap";
import { getActor, getWebfinger } from "@/src/activitypub/network";
import { convertActorUrlToMainKey, parseSearch, parseWebfinger } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { follows, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, eq, like, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 20;

type DBUser = typeof users.$inferSelect;

type UserPayload = JwtPayload & {
    username: string,
}

interface SearchResult {
    items: {
        username: string,
        domain: string | null,
        displayName: string,
        avatarUrl: string,
        actorUrl: string,
        originalUrl: string,
        isFollowing: boolean,
    }[]
}

export async function GET(request: Request) {
    // 获取参数
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    // 解析用户名和域名（统一补上前导 @）
    const [username, domain] = parseSearch(q.startsWith("@") ? q : `@${q}`);

    const db = getDBClient();

    // 查询登录用户（可选，远端搜索需要用它签名）
    let user: DBUser | null = null;
    const auth = request.headers.get("Authorization");
    if (auth) {
        const [type, token] = auth.split(" ");
        if (type === "Bearer" && token && await verifyJwt(token, env.JWT_SECRET)) {
            const payload = decodeJwt<UserPayload>(token);
            if (payload?.username) {
                user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];
            }
        }
    }

    const data: SearchResult = { items: [] };

    // 本地实例用户名查询：没有域名，或域名就是本实例
    if (!domain || domain.toLowerCase() === url.host.toLowerCase()) {
        if (username) {
            const locals = await db.select().from(users).where(
                or(
                    like(users.username, `%${username}%`),
                    like(users.displayName, `%${username}%`),
                ),
            ).limit(MAX_ITEMS);

            for (const local of locals) {
                let isFollowing = false;
                if (user) {
                    const followed = (await db.select().from(follows).where(
                        and(
                            eq(follows.follower, user.actorUrl),
                            eq(follows.following, local.actorUrl),
                        ),
                    ))[0];
                    isFollowing = !!followed;
                }

                data.items.push({
                    username: local.username,
                    displayName: local.displayName,
                    avatarUrl: local.avatarUrl ?? "",
                    actorUrl: local.actorUrl,
                    domain: null,
                    originalUrl: local.actorUrl,
                    isFollowing: isFollowing,
                });
            }
        }

        return Response.json(data, {
            status: 200,
        });
    }

    // 请求远程用户需要登录（签名用私钥）
    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    // 请求 Webfinger, Actor
    let actor: APActor | null = null;
    const wfRes = await getWebfinger(username, domain);
    if (wfRes.ok) {
        const wf = await wfRes.json<APWebfinger>();
        const pwf = parseWebfinger(wf);
        const userMkUrl = convertActorUrlToMainKey(user.actorUrl);
        const atRes = await getActor(pwf.actorUrl, user.privateKey, userMkUrl);
        if (atRes?.ok) {
            actor = await atRes.json<APActor>();
        }
    } else {
        console.log(await wfRes.json());
    }

    // TODO: 如果找到了用户就存进数据库

    // 检查是否关注过
    let isFollowing = false;
    if (actor) {
        const followed = (await db.select().from(follows).where(
            and(
                eq(follows.follower, user.actorUrl),
                eq(follows.following, actor.id),
            ),
        ))[0];
        isFollowing = !!followed;
    }

    // 返回远程搜索结果
    if (actor) {
        data.items.push({
            username: actor.preferredUsername,
            displayName: actor.name,
            avatarUrl: actor.icon?.url ?? "",
            actorUrl: actor.id,
            domain: domain,
            originalUrl: actor.url ?? "",
            isFollowing: isFollowing,
        })
    }

    return Response.json(data, {
        status: 200,
    })
}
