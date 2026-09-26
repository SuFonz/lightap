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
