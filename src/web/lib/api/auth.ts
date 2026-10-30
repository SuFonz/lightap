import type { AuthRequest } from "@/web/types";
import { request } from "./client";

// login / register / logout 都通过 HttpOnly cookie 维持登录态，响应体为空。
export function login(body: AuthRequest) {
    return request<Record<string, never>>("/api/v1/login", { method: "POST", body });
}

export function register(body: AuthRequest) {
    return request<Record<string, never>>("/api/v1/register", { method: "POST", body });
}

export function logout() {
    return request<Record<string, never>>("/api/v1/logout", { method: "POST" });
}

/**
 * 注销账号：DELETE /api/v1/me
 *
 * 硬删除：账号及其全部内容真正从数据库移除，不可恢复。
 * 成功后服务端会清除登录 cookie。
 */
export function deleteAccount() {
    return request<Record<string, never>>("/api/v1/me", { method: "DELETE" });
}
