import { env } from "cloudflare:workers";
import { getUserByPreferredUsername, createUser } from "@/lib/db/users";
import { generateActivityPubKeyPair } from "@/lib/util/keypair";
import { hashPassword } from "@/lib/util/password";
import { sign } from "@/lib/util/jwt";
import { AuthToken, HttpError } from "@/lib/types/http";

const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 天

interface RegisterBody {
    username?: string;
    password?: string;
}

export async function POST(request: Request) {
    let body: RegisterBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "请求格式错误" } satisfies HttpError, { status: 400 });
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (
        username.length < 2 ||
        username.length > 32 ||
        !USERNAME_RE.test(username)
    ) {
        return Response.json(
            { error: "用户名只能包含字母、数字和下划线，长度 2-32 位" },
            { status: 400 }
        );
    }

    if (password.length < 6 || password.length > 128) {
        return Response.json(
            { error: "密码长度需在 6-128 位之间" },
            { status: 400 }
        );
    }

    try {
        if (await getUserByPreferredUsername(username)) {
            return Response.json({ error: "用户名已被占用" }, { status: 409 });
        }

        const [passwordHash, keyPair] = await Promise.all([
            hashPassword(password),
            generateActivityPubKeyPair(),
        ]);

        await createUser({
            origin: new URL(request.url).origin,
            username,
            passwordHash,
            publicKeyPem: keyPair.publicKeyPem,
            privateKeyPem: keyPair.privateKeyPem,
        });

        const token = await sign(
            { username },
            env.JWT_SECRET,
            TOKEN_TTL
        );

        return Response.json({ username, token } satisfies AuthToken, { status: 201 });
    } catch (e) {
        console.error("register failed:", e);
        return Response.json({ error: "注册失败，请稍后重试" } satisfies HttpError, { status: 500 });
    }
}
