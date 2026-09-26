import type {
    CreateNoteRequest,
    CreateNoteResponse,
    FeedTab,
    NoteThreadResponse,
    PostListResponse,
} from "@/web/types";
import { request } from "./client";

/** 时间线：GET /api/v1/feed?type=all|local|following */
export function fetchFeed(type: FeedTab, params: { limit?: number; maxId?: number } = {}) {
    const query = new URLSearchParams({ type });
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    return request<PostListResponse>(`/api/v1/feed?${query}`);
}

/** 某个用户的帖子：GET /api/v1/users/[username]/posts */
export function fetchUserPosts(username: string, params: { limit?: number; maxId?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    const suffix = query.toString() ? `?${query}` : "";
    return request<PostListResponse>(`/api/v1/users/${encodeURIComponent(username)}/posts${suffix}`);
}

export function createNote(body: CreateNoteRequest) {
    return request<CreateNoteResponse>("/api/v1/notes", { method: "POST", body });
}

/** 删除帖子：DELETE /api/v1/notes/[uuid] */
export function deleteNote(uuid: string) {
    return request<Record<string, never>>(`/api/v1/notes/${encodeURIComponent(uuid)}`, { method: "DELETE" });
}

/** 点赞：POST /api/v1/notes/[uuid]/like */
export function likeNote(uuid: string) {
    return request<Record<string, never>>(`/api/v1/notes/${encodeURIComponent(uuid)}/like`, { method: "POST" });
}

/** 取消点赞：DELETE /api/v1/notes/[uuid]/like */
export function unlikeNote(uuid: string) {
    return request<Record<string, never>>(`/api/v1/notes/${encodeURIComponent(uuid)}/like`, { method: "DELETE" });
}

export function fetchThread(uuid: string) {
    return request<NoteThreadResponse>(`/api/v1/notes/${encodeURIComponent(uuid)}`);
}
