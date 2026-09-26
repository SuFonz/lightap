/**
 * 会话 cookie 工具（前后端共用，不依赖 cloudflare/db）。
 *
 * 登录态放在 HttpOnly cookie 里：浏览器 JS 读不到，只能随请求发给服务端，
 * 由 `proxy.ts` 校验、`resolveRequestUser` 使用。
 */

export const SESSION_TOKEN_COOKIE = "lightap_token";
export const SESSION_USERNAME_COOKIE = "lightap_user";

/** 7 天 */
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

// TODO: 加上 Secure
const BASE = "Path=/; HttpOnly; SameSite=Lax";

/** 登录成功后要下发的 Set-Cookie 值（JWT + 用户名） */
export function sessionCookieValues(token: string, username: string): string[] {
    return [
        `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${BASE}; Max-Age=${SESSION_MAX_AGE}`,
        `${SESSION_USERNAME_COOKIE}=${encodeURIComponent(username)}; ${BASE}; Max-Age=${SESSION_MAX_AGE}`,
    ];
}

/** 退出登录时要下发的 Set-Cookie 值（清除） */
export function clearSessionCookieValues(): string[] {
    return [
        `${SESSION_TOKEN_COOKIE}=; ${BASE}; Max-Age=0`,
        `${SESSION_USERNAME_COOKIE}=; ${BASE}; Max-Age=0`,
    ];
}

/** 把 cookie 值组装成可返回的 Headers */
export function cookieHeaders(values: string[]): Headers {
    const headers = new Headers();
    for (const value of values) {
        headers.append("Set-Cookie", value);
    }
    return headers;
}
