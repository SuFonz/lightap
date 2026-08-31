import { env } from "cloudflare:workers";
import { verify } from "@/lib/util/jwt";
import { UserJwtPayload } from "@/lib/types/http";

const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
        return Response.json({ error: "未登录" }, { status: 401 });
    }

    try {
        const payload = await verify<UserJwtPayload>(token, env.JWT_SECRET);
        return Response.json({ username: payload.username });
    } catch {
        return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
    }
}
