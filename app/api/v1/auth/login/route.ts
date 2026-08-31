import { env } from "cloudflare:workers";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { verifyPassword, hashPassword } from "@/lib/util/password";
import { sign } from "@/lib/util/jwt";

const dynamic = "force-dynamic";

const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 天

// 用于用户不存在时做等时长校验，避免时序侧信道泄露用户是否存在
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
    dummyHashPromise ??= hashPassword("dummy-password");
    return dummyHashPromise;
}

interface LoginBody {
    username?: string;
    password?: string;
}

export async function POST(request: Request) {
    let body: LoginBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "请求格式错误" }, { status: 400 });
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!username || !password) {
        return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
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

        return Response.json({ username: user.preferred_username, token });
    } catch (e) {
        console.error("login failed:", e);
        return Response.json({ error: "登录失败，请稍后重试" }, { status: 500 });
    }
}
