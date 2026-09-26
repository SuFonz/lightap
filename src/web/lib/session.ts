/**
 * 会话 cookie 名（与后端共用，见 src/lib/cookies.ts）。
 * 登录态由服务端通过 HttpOnly cookie 下发，客户端不再读写 cookie。
 */

export { SESSION_TOKEN_COOKIE, SESSION_USERNAME_COOKIE } from "@/src/lib/cookies";
