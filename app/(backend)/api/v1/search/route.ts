import { APActor, APWebfinger } from "@/src/activitypub/ap";
import { getActor, getWebfinger } from "@/src/activitypub/network";
import { convertActorUrlToMainKey, parseSearch, parseWebfinger } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { follows, users } from "@/src/db/schema";
import { storeRemoteActor } from "@/src/lib/actor";
import { resolveRequestUser } from "@/src/lib/auth";
import { and, eq, inArray, like, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 20;

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
    const user = await resolveRequestUser(request);

    const data: SearchResult = { items: [] };

    // 本地数据库查询：没有域名 / 域名就是本实例 / 未登录（未登录只能搜数据库里已有的用户）
    if (!domain || domain.toLowerCase() === url.host.toLowerCase() || !user) {
        if (username) {
            const locals = await db.select().from(users).where(
                or(
                    like(users.username, `%${username}%`),
                    like(users.displayName, `%${username}%`),
                ),
            ).limit(MAX_ITEMS);

            // 一次查出当前用户关注了其中哪些人，避免在循环里逐个查（N+1）
            let following = new Set<string>();
            if (user && locals.length > 0) {
                const followed = await db.select().from(follows).where(
                    and(
                        eq(follows.follower, user.actorUrl),
                        inArray(follows.following, locals.map(local => local.actorUrl)),
                    ),
                );
                following = new Set(followed.map(f => f.following));
            }

            for (const local of locals) {
                data.items.push({
                    username: local.username,
                    displayName: local.displayName,
                    avatarUrl: local.avatarUrl ?? "",
                    actorUrl: local.actorUrl,
                    domain: local.domain === url.host ? null : local.domain,
                    originalUrl: local.actorUrl,
                    isFollowing: following.has(local.actorUrl),
                });
            }
        }

        return Response.json(data, {
            status: 200,
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
        } else {
            console.log(await atRes.json());
        }

    } else {
        console.log(await wfRes.json());
    }

    // 找到的远程用户落库，方便 feed / directory 显示作者信息
    if (actor) {
        await storeRemoteActor(actor);
    }

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
