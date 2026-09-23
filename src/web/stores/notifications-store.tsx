"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { notificationsApi } from "@/web/lib/api";
import { useSession } from "@/web/stores/session-store";
import type { NotificationItem } from "@/web/types";

interface NotificationsValue {
    items: NotificationItem[];
    /** 未读通知数（用于图标角标） */
    unreadCount: number;
    loading: boolean;
    /** 重新拉取通知 */
    refresh: () => Promise<void>;
    /** 标记全部已读并刷新 */
    markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!session) {
            setItems([]);
            return;
        }
        setLoading(true);
        try {
            const { items } = await notificationsApi.list(session.token);
            setItems(items);
        } catch {
            // 拉取失败按“没有通知”处理，不打断页面
        } finally {
            setLoading(false);
        }
    }, [session]);

    // 应用加载 / 登录态变化时拉一次，供导航图标角标使用
    useEffect(() => {
        void refresh();
    }, [refresh]);

    const markAllRead = useCallback(async () => {
        if (!session) return;

        // 把已加载的未读通知 id 一次性发过去；成功后本地直接更新已读，无需再 refresh
        const unreadIds = items.filter((item) => !item.read).map((item) => item.id);
        if (unreadIds.length === 0) return;

        try {
            await notificationsApi.markRead(unreadIds, session.token);
            setItems((prev) =>
                prev.map((item) => (unreadIds.includes(item.id) ? { ...item, read: true } : item)),
            );
        } catch {
            // 失败就保持未读
        }
    }, [session, items]);

    const value = useMemo<NotificationsValue>(
        () => ({
            items,
            unreadCount: items.filter((item) => !item.read).length,
            loading,
            refresh,
            markAllRead,
        }),
        [items, loading, refresh, markAllRead],
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
    return ctx;
}
