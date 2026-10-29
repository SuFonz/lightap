import type {
    FollowListResponse,
    FollowRequest,
    SearchResponse,
    UnfollowRequest,
    UpdateProfileRequest,
    UpdateProfileResponse,
    UserProfileResponse,
} from "@/web/types";
import { request } from "./client";

/** 更新当前用户资料：PATCH /api/v1/me */
export function updateProfile(body: UpdateProfileRequest) {
    return request<UpdateProfileResponse>("/api/v1/me", { method: "PATCH", body });
}

export function search(query: string) {
    return request<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(query)}`);
}

export function fetchProfile(username: string, domain?: string) {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";
    return request<UserProfileResponse>(`/api/v1/users/${encodeURIComponent(username)}${query}`);
}

export function follow(body: FollowRequest) {
    return request<Record<string, never>>("/api/v1/follow", { method: "POST", body });
}

export function unfollow(body: UnfollowRequest) {
    return request<Record<string, never>>("/api/v1/unfollow", { method: "POST", body });
}

/**
 * 关注 / 粉丝列表：GET /api/v1/users/[username]/following|followers
 *
 * 分页游标是 follows.id（关注关系的建立时间），不是 users.id。
 */
export function fetchFollowList(
    username: string,
    direction: "following" | "followers",
    params: { limit?: number; maxId?: number; domain?: string | null } = {},
) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    if (params.domain) query.set("domain", params.domain);
    const suffix = query.toString() ? `?${query}` : "";
    return request<FollowListResponse>(
        `/api/v1/users/${encodeURIComponent(username)}/${direction}${suffix}`,
    );
}
