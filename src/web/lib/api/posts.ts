import type {
    CreateNoteRequest,
    CreateNoteResponse,
    FeedTab,
    NoteThreadResponse,
    PostListResponse,
} from "@/web/types";
import { request } from "./client";

/** 时间线：GET /api/v1/feed?type=all|local|following */
export function fetchFeed(type: FeedTab, params: { limit?: number; maxId?: number } = {}, token?: string) {
    const query = new URLSearchParams({ type });
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    return request<PostListResponse>(`/api/v1/feed?${query}`, { token });
}

/** 某个用户的帖子：GET /api/v1/users/[username]/posts */
export function fetchUserPosts(username: string, params: { limit?: number; maxId?: number } = {}, token?: string) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    const suffix = query.toString() ? `?${query}` : "";
    return request<PostListResponse>(`/api/v1/users/${encodeURIComponent(username)}/posts${suffix}`, { token });
}

export function createNote(token: string, body: CreateNoteRequest) {
    return request<CreateNoteResponse>("/api/v1/notes", { method: "POST", token, body });
}

/** 点赞：POST /api/v1/notes/[uuid]/like */
export function likeNote(uuid: string, token: string) {
    return request<Record<string, never>>(`/api/v1/notes/${encodeURIComponent(uuid)}/like`, { method: "POST", token });
}

/** 取消点赞：DELETE /api/v1/notes/[uuid]/like */
export function unlikeNote(uuid: string, token: string) {
    return request<Record<string, never>>(`/api/v1/notes/${encodeURIComponent(uuid)}/like`, { method: "DELETE", token });
}

export function fetchThread(uuid: string, token?: string) {
    return request<NoteThreadResponse>(`/api/v1/notes/${encodeURIComponent(uuid)}`, { token });
}
