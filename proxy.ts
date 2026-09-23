import { NextRequest, NextResponse } from "next/server";
import { JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";

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
            pathname.startsWith("/api/v1/notifications")
        );

    // 验证 JWT（verifyJwt 无效时返回 null，不会抛异常）
    const authorization = req.headers.get("authorization");
    let payload: UserPayload | null = null;
    if (authorization?.startsWith("Bearer ")) {
        payload = await verifyJwt<UserPayload>(authorization.slice(7), env.JWT_SECRET);
        // 公开 GET 不因坏 token 被拦；其余接口坏 token 直接 401
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
    const requestHeaders = new Headers(req.headers);
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
