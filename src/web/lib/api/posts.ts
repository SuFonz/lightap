import type { CreateNoteRequest, NoteThreadResponse } from "@/web/types";
import { request } from "./client";

export function createNote(token: string, body: CreateNoteRequest) {
    return request<Record<string, never>>("/api/v1/notes", { method: "POST", token, body });
}

export function fetchThread(uuid: string, token?: string) {
    return request<NoteThreadResponse>(`/api/v1/notes/${encodeURIComponent(uuid)}`, { token });
}
