import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { exportPrivateKey, exportPublicKey, generateRSAKeyPair } from "@/src/utils/keypair";
import { hashPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { drizzle } from 'drizzle-orm/d1';

export const dynamic = "force-dynamic";

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

}
