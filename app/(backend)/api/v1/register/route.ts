import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { exportPrivateKey, exportPublicKey, generateRSAKeyPair } from "@/src/utils/keypair";
import { hashPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

interface Body {
    username: string,
    password: string,
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
    
    // 发送jwt
    const id = result[0].insertedId;
    const token = await signJwt({ sub: String(id), username }, env.JWT_SECRET, { expiresIn: 7 * 24 * 60 * 60 });
    return Response.json({
        token: token,
    }, {
        status: 200,
    });
}
