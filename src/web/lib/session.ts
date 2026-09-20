/** 会话工具：登录态以 cookie 保存，SSR 首屏即可识别。 */

export const SESSION_TOKEN_COOKIE = "lightap_token";
export const SESSION_USERNAME_COOKIE = "lightap_user";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/** 写入或清除会话 cookie（仅在浏览器端生效） */
export function writeSessionCookies(username: string | null, token: string | null): void {
    if (typeof document === "undefined") return;

    const maxAge = username && token ? COOKIE_MAX_AGE : 0;
    const tokenValue = token ? encodeURIComponent(token) : "";
    const usernameValue = username ? encodeURIComponent(username) : "";

    document.cookie = `${SESSION_TOKEN_COOKIE}=${tokenValue}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    document.cookie = `${SESSION_USERNAME_COOKIE}=${usernameValue}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
