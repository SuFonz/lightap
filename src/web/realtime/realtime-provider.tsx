"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useNotifications } from "@/web/stores/notifications-store";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import type { NotificationItem, PostListItem } from "@/web/types";

/**
 * SSE 实时连接管理器（全局挂一次）。
 *
 * - 连接 `/api/v1/events`：同源，`EventSource` 会自动带 cookie；
 * - `note.created` → 插入时间线；`notification.created` → 插入通知；
 * - **登录态变化时重建连接**：连接的身份在建立瞬间就用 cookie 定死了，
 *   所以 session.username 一变（登录/登出/换号）必须 close 再 new，才能用新身份订阅。
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const { applyRemoteNote } = useTimeline();
    const { addNotification } = useNotifications();

    // 用 ref 持有最新回调，避免回调变化（例如切换 tab）导致整个连接重连
    const applyNoteRef = useRef(applyRemoteNote);
    applyNoteRef.current = applyRemoteNote;
    const addNotificationRef = useRef(addNotification);
    addNotificationRef.current = addNotification;

    useEffect(() => {
        const source = new EventSource("/api/v1/events");

        const onNote = (event: Event) => {
            try {
                applyNoteRef.current(JSON.parse((event as MessageEvent).data) as PostListItem);
            } catch {
                // 忽略坏数据
            }
        };
        const onNotification = (event: Event) => {
            try {
                addNotificationRef.current(JSON.parse((event as MessageEvent).data) as NotificationItem);
            } catch {
                // 忽略坏数据
            }
        };

        source.addEventListener("note.created", onNote);
        source.addEventListener("notification.created", onNotification);

        return () => {
            source.removeEventListener("note.created", onNote);
            source.removeEventListener("notification.created", onNotification);
            source.close();
        };
    }, [session?.username]);

    return <>{children}</>;
}
