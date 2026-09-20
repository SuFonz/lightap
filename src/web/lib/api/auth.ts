import type { AuthRequest, AuthResponse } from "@/web/types";
import { request } from "./client";

export function login(body: AuthRequest) {
    return request<AuthResponse>("/api/v1/login", { method: "POST", body });
}

export function register(body: AuthRequest) {
    return request<AuthResponse>("/api/v1/register", { method: "POST", body });
}

export function logout() {
    return request<Record<string, never>>("/api/v1/logout", { method: "POST" });
}
