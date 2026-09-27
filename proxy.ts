import { NextRequest, NextResponse } from "next/server";
import { JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { SESSION_TOKEN_COOKIE } from "@/src/lib/cookies";

type UserPayload = JwtPayload & {
    username: string,
}

export async function proxy(req: NextRequest) {
    // 登录注册登出放行
    const pathname = req.nextUrl.pathname;

    if (
        pathname === "/api/v1/login" ||
        pathname === "/api/v1/register" ||
        pathname === "/api/v1/logout"
    ) {
        return NextResponse.next();
    }

    // 这些接口的 GET 请求允许匿名：feed / notes/[uuid] / search / users/[username] / users/[username]/posts
    // 游客、以及带了过期/无效 token 的请求都直接放行
    const publicGet =
        req.method === "GET" && (
            pathname === "/api/v1/feed" ||
            pathname.startsWith("/api/v1/notes/") ||
            pathname === "/api/v1/search" ||
            pathname.startsWith("/api/v1/users/")
        );

    // 必须登录的接口：发帖、删帖、关注、取关、点赞、通知
    const required =
        !publicGet && (
            (pathname === "/api/v1/notes" && req.method === "POST") ||
            (pathname.startsWith("/api/v1/notes/") && req.method === "DELETE") ||
            (pathname.startsWith("/api/v1/notes/") && pathname.endsWith("/like")) ||
            pathname === "/api/v1/follow" ||
            pathname === "/api/v1/unfollow" ||
            pathname === "/api/v1/me" ||
            pathname.startsWith("/api/v1/notifications")
        );

    // 从 cookie 里取 JWT 验证（verifyJwt 无效时返回 null，不会抛异常）
    const token = req.cookies.get(SESSION_TOKEN_COOKIE)?.value;
    let payload: UserPayload | null = null;
    if (token) {
        payload = await verifyJwt<UserPayload>(token, env.JWT_SECRET);
        // 公开 GET 不因坏 cookie 被拦；其余接口坏 cookie 直接 401
        if (!payload && !publicGet) {
            return NextResponse.json({
                error: "Invalid token",
            }, {
                status: 401,
            });
        }
    }

    // 需要登录但没有有效 token
    if (required && !payload) {
        return NextResponse.json({
            error: "Unauthorized",
        }, {
            status: 401,
        });
    }

    // 把用户 id 透传给后续请求（要改请求头，不是响应头；无效 token 时不带）
    // 先无条件清掉客户端自带的 x-user-id：未登录（payload 为 null）时若不清，
    // 攻击者可自带 x-user-id 冒充任意用户，命中 resolveRequestUser 造成越权。
    const requestHeaders = new Headers(req.headers);
    requestHeaders.delete("x-user-id");
    if (payload) {
        requestHeaders.set("x-user-id", String(payload.sub));
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: [
        "/api/:path*"
    ]
};
