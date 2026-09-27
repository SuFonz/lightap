import type {
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

export function fetchProfile(username: string) {
    return request<UserProfileResponse>(`/api/v1/users/${encodeURIComponent(username)}`);
}

export function follow(body: FollowRequest) {
    return request<Record<string, never>>("/api/v1/follow", { method: "POST", body });
}

export function unfollow(body: UnfollowRequest) {
    return request<Record<string, never>>("/api/v1/unfollow", { method: "POST", body });
}
