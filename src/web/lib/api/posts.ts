import type { CreateNoteRequest, FeedResponse, FeedTab, NoteThreadResponse } from "@/web/types";
import { request } from "./client";

export function fetchFeed(type: FeedTab, params: { limit?: number; maxId?: number } = {}, token?: string) {
    const query = new URLSearchParams({ type });
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.maxId !== undefined) query.set("maxId", String(params.maxId));
    return request<FeedResponse>(`/api/v1/feed?${query}`, { token });
}

export function createNote(token: string, body: CreateNoteRequest) {
    return request<Record<string, never>>("/api/v1/notes", { method: "POST", token, body });
}

export function fetchThread(uuid: string, token?: string) {
    return request<NoteThreadResponse>(`/api/v1/notes/${encodeURIComponent(uuid)}`, { token });
}
