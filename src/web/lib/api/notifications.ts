import type { NotificationsResponse } from "@/web/types";
import { request } from "./client";

/** 通知列表：GET /api/v1/notifications */
export function list(params: { limit?: number; maxId?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    const suffix = query.toString() ? `?${query}` : "";
    return request<NotificationsResponse>(`/api/v1/notifications${suffix}`);
}

/** 标记指定通知为已读：POST /api/v1/notifications/read */
export function markRead(ids: number[]) {
    return request<Record<string, never>>("/api/v1/notifications/read", {
        method: "POST",
        body: { ids },
    });
}
