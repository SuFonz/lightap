import type { FollowRequest, SearchResponse, UnfollowRequest, UserProfileResponse } from "@/web/types";
import { request } from "./client";

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
