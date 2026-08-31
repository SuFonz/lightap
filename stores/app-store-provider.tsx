"use client";

import type { ReactNode } from "react";
import { NotificationStoreProvider } from "./notification-store";
import { PostStoreProvider } from "./post-store";
import { UserStoreProvider } from "./user-store";

export function AppStoreProvider({ children }: { children: ReactNode }) {
    return (
        <UserStoreProvider>
            <PostStoreProvider>
                <NotificationStoreProvider>{children}</NotificationStoreProvider>
            </PostStoreProvider>
        </UserStoreProvider>
    );
}
