"use client";

import type { ReactNode } from "react";
import { DirectoryProvider } from "@/web/stores/directory-store";
import { SessionProvider } from "@/web/stores/session-store";
import { TimelineProvider } from "@/web/stores/timeline-store";
import { UiProvider } from "@/web/stores/ui-store";
import type { Session } from "@/web/types";

/** 组合各领域 store，顺序即依赖顺序：会话 → 用户 → 时间线 → UI。 */
export function StoreProvider({
    initialSession,
    children,
}: {
    initialSession?: Session | null;
    children: ReactNode;
}) {
    return (
        <SessionProvider initialSession={initialSession}>
            <DirectoryProvider>
                <TimelineProvider>
                    <UiProvider>{children}</UiProvider>
                </TimelineProvider>
            </DirectoryProvider>
        </SessionProvider>
    );
}
