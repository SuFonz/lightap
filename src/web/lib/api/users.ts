import type { FollowRequest, SearchResponse, UnfollowRequest, UserProfileResponse } from "@/web/types";
import { request } from "./client";

export function search(query: string, token?: string) {
    return request<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(query)}`, { token });
}

export function fetchProfile(username: string, token?: string) {
    return request<UserProfileResponse>(`/api/v1/users/${encodeURIComponent(username)}`, { token });
}

export function follow(token: string, body: FollowRequest) {
    return request<Record<string, never>>("/api/v1/follow", { method: "POST", token, body });
}

export function unfollow(token: string, body: UnfollowRequest) {
    return request<Record<string, never>>("/api/v1/unfollow", { method: "POST", token, body });
}
