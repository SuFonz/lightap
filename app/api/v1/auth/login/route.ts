import { env } from "cloudflare:workers";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { verifyPassword, hashPassword, getDummyHash } from "@/lib/util/password";
import { sign } from "@/lib/util/jwt";
import { AuthBody, AuthToken, HttpError } from "@/lib/types/http";

const dynamic = "force-dynamic";

const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 天

export async function POST(request: Request) {
    let body: AuthBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "请求格式错误" } satisfies HttpError, { status: 400 });
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!username || !password) {
        return Response.json({ error: "请输入用户名和密码" } satisfies HttpError, { status: 400 });
    }

    try {
        const user = await getUserByPreferredUsername(username);
        const ok = user?.password_hash
            ? await verifyPassword(password, user.password_hash)
            : await verifyPassword(password, await getDummyHash());

        if (!user || !ok) {
            return Response.json(
                { error: "用户名或密码错误" },
                { status: 401 }
            );
        }

        const token = await sign(
            { username: user.preferred_username },
            env.JWT_SECRET,
            TOKEN_TTL
        );

        return Response.json({ username: user.preferred_username, token } satisfies AuthToken);
    } catch (e) {
        console.error("login failed:", e);
        return Response.json({ error: "登录失败，请稍后重试" } satisfies HttpError, { status: 500 });
    }
}
