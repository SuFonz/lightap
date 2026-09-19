import { APActor, APWebfinger } from "@/src/activitypub/ap";
import { getActor, getWebfinger } from "@/src/activitypub/network";
import { parseWebfinger } from "@/src/activitypub/tools";
import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { exportPrivateKey, exportPublicKey, generateRSAKeyPair } from "@/src/utils/keypair";
import { hashPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { drizzle } from 'drizzle-orm/d1';

export const dynamic = "force-dynamic";

interface SearchResult {
    items: {
        username: string,
        domain: string | null,
        displayName: string,
        avatarUrl: string,
        actorUrl: string,
        originalUrl: string,
    }[]
}

function parseSearch(
    content: string
): [string, string?] {
    const value = content.trim();

    if (!value.startsWith("@")) {
        return ["", undefined];
    }

    const account = value.slice(1);

    const index = account.indexOf("@");

    if (index === -1) {
        return [account];
    }

    return [
        account.slice(0, index),
        account.slice(index + 1),
    ];
}

export async function GET(request: Request) {
    // 获取参数
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    
    // 解析用户名和域名
    const [username, domain] = parseSearch(q ?? "");

    // 请求 Webfinger, Actor, followers, following, inbox, outbox
    // (可能需要签名)
    // TODO：登录认证之后才能请求别的服务器
    let actor: APActor | null = null;
    if (domain) {
        const wfRes = await getWebfinger(username, domain);
        if (wfRes.ok) {
            const wf = await wfRes.json<APWebfinger>();
            const pwf = parseWebfinger(wf);
            const atRes = await getActor(pwf.actorUrl);
            if (atRes?.ok) {
                actor = await atRes.json<APActor>();
            }
        }
    }

    // TODO: 如果找到了用户就存进数据库

    // TODO: 进行本地实例用户名查询

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
        })
    }

    return Response.json(data, {
        status: 200,
    })
}
