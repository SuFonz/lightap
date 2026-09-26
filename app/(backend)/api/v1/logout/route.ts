import { clearSessionCookieValues, cookieHeaders } from "@/src/lib/cookies";

export const dynamic = "force-dynamic";

/** 退出登录：清除会话 cookie（响应体为空） */
export async function POST(request: Request) {
    return new Response(null, {
        status: 200,
        headers: cookieHeaders(clearSessionCookieValues()),
    });
}
