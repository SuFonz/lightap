"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { seedNotifications } from "@/lib/client/mock-data";
import type { AppNotification } from "@/lib/client/types";

interface NotificationStoreValue {
    notifications: AppNotification[];
    unreadCount: number;
    markAllNotificationsRead: () => void;
}

const NotificationStoreContext = createContext<NotificationStoreValue | null>(null);

export function NotificationStoreProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>(seedNotifications);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.read).length,
        [notifications],
    );

    const value = useMemo<NotificationStoreValue>(
        () => ({ notifications, unreadCount, markAllNotificationsRead }),
        [notifications, unreadCount, markAllNotificationsRead],
    );

    return (
        <NotificationStoreContext.Provider value={value}>
            {children}
        </NotificationStoreContext.Provider>
    );
}

export function useNotificationStore() {
    const ctx = useContext(NotificationStoreContext);
    if (!ctx) throw new Error("useNotificationStore must be used within NotificationStoreProvider");
    return ctx;
}
