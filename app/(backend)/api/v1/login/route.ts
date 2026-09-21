import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { verifyPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { and, eq, like } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

interface Body {
    username: string,
    password: string,
}

export async function POST(request: Request) {
    // 解析请求
    const body = await request.json<Body>();
    const username = body.username;
    const password = body.password;

    // 数据库获取用户（只允许本站用户：username 相同 且 actorUrl 属于本实例）
    const url = new URL(request.url);
    const db = getDBClient();
    const result = await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.domain, url.host),
        ),
    );
    if (result.length == 0) {
        return Response.json({
            error: "User not found."
        }, {
            status: 401,
        });
    }

    // 检查密码是否正确
    const user = result[0];
    const correct = await verifyPassword(password, user.passwordHash);
    if (!correct) {
        return Response.json({
            error: "Password is incorrect."
        }, {
            status: 401,
        });
    }

    // 返回 JWT
    const token = await signJwt({ sub: String(user.id), username }, env.JWT_SECRET, { expiresIn: 7 * 24 * 60 * 60 })
    return Response.json({
        token: token,
    }, {
        status: 200,
    });
}
