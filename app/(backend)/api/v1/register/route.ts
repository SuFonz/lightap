import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { exportPrivateKey, exportPublicKey, generateRSAKeyPair } from "@/src/utils/keypair";
import { hashPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { cookieHeaders, sessionCookieValues } from "@/src/lib/cookies";
import { isBotDetectionEnabled, verifyBotToken } from "@/src/bot-detection";

export const dynamic = "force-dynamic";

interface Body {
    username: string,
    password: string,
    /** Turnstile widget 产出的 token；未启用机器人检测时不传 */
    botToken?: string,
}

export async function POST(request: Request) {
    const body = await request.json<Body>();

    // 检查账号密码
    const username = body.username;
    const password = body.password;
    if (!username || !password) {
        return Response.json({
            error: "Username or password cannot be empty."
        }, {
            status: 401
        });
    }

    // Actor Url
    const url = new URL(request.url);
    const actorUrl = `${url.origin}/users/${username}`;

    // 检查用户名是否重复（只算本站：username 相同 且 actorUrl 属于本实例）
    //
    // 顺序很重要：查重必须放在机器人验证**之前**。
    // Turnstile 的 token 是一次性的，验证通过即被消耗；
    // 如果先验证再查重，用户名被占用时用户会白白浪费一次人机验证，
    // 而且前端必须重新挑战才能再次提交（体验很差）。
    // 查重只是一次索引查询，成本远低于验证，先做更合理。
    const db = getDBClient();
    const existing = (await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.actorUrl, actorUrl),
        ),
    ))[0];
    if (existing) {
        return Response.json({
            error: "Username is already taken."
        }, {
            status: 409
        });
    }

    // 机器人检测（可选）：只有配置了 TURNSTILE_SECRET_KEY 才校验。
    // 放在用户名查重之后、生成密钥对之前：
    // - 查重在前：用户名不合法时不必消耗验证
    // - 生成密钥对在后：验证不通过时不必白跑一次 RSA 生成
    if (isBotDetectionEnabled()) {
        const remoteIp = request.headers.get("CF-Connecting-IP") ?? undefined;
        const check = await verifyBotToken(body.botToken, remoteIp);
        if (!check.ok) {
            // 不把具体原因返回给客户端，避免给攻击者提供调参依据
            return Response.json({
                error: "Bot verification failed."
            }, {
                status: 403
            });
        }
    }

    // 密码哈希
    const passwordHash = await hashPassword(password);

    // 生成密钥对
    const keyPair = await generateRSAKeyPair();
    const [publicKey, privateKey] = await Promise.all([
        exportPublicKey(keyPair.publicKey),
        exportPrivateKey(keyPair.privateKey),
    ]);

    // 存入数据库
    type InsertUser = typeof users.$inferInsert;
    const result = await db.insert(users).values({
        username: username,
        domain: url.host,
        displayName: username,
        passwordHash: passwordHash,
        actorUrl: actorUrl,
        publicKey: publicKey,
        privateKey: privateKey,
    }).returning({ insertedId: users.id });
    
    // 签发 JWT 并写进 HttpOnly cookie（响应体为空）
    const id = result[0].insertedId;
    const token = await signJwt({ sub: String(id), username }, env.JWT_SECRET, { expiresIn: 7 * 24 * 60 * 60 });
    return new Response(null, {
        status: 200,
        headers: cookieHeaders(sessionCookieValues(token, username)),
    });
}
