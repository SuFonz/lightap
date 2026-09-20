import { APActor, APWebfinger } from "@/src/activitypub/ap";
import { getActor, getWebfinger } from "@/src/activitypub/network";
import { convertActorUrlToMainKey, parseSearch, parseWebfinger } from "@/src/activitypub/tools";
import { follows, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, signJwt, verifyJwt } from "@/src/utils/jwt";
import { exportPrivateKey, exportPublicKey, generateRSAKeyPair } from "@/src/utils/keypair";
import { hashPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from 'drizzle-orm/d1';

export const dynamic = "force-dynamic";

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
    const q = url.searchParams.get("q");
    
    // 解析用户名和域名
    const [username, domain] = parseSearch(q ?? "");

    //  TODO: 如果未认证旧只能搜索本地实例的用户

    // TODO: 有域名才请求远程用户
    if (!domain) {
        return;
    }

    // 查询登录用户
    const db = drizzle(env.DB);
    let user: DBUser | null = null;

    try {

        const auth = request.headers.get("Authorization");
        if (!auth) {
            throw new Error("Unauthorized.");
        }

        const [type, token] = auth.split(" ");
        if (type !== "Bearer" || !token) {
            throw new Error("Unauthorized.");
        }

        const valid = await verifyJwt(token, env.JWT_SECRET);
        if (!valid) {
            throw new Error("Unauthorized.");
        }

        // 获取用户（签名需要）
        const payload = await decodeJwt<UserPayload>(token);
        if (!payload?.username) {
            throw new Error("Unauthorized.");
        }

        user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];

    } catch (error: any) {}

    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    // 登录认证之后才能请求别的服务器
    // 请求 Webfinger, Actor, followers, following, inbox, outbox
    let actor: APActor | null = null;
    if (domain) {
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
    }

    // TODO: 如果找到了用户就存进数据库

    // TODO: 进行本地实例用户名查询

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

    // 返回搜索结果
    const data: SearchResult = { items: [] };
    if (actor && domain) {
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
