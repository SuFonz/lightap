"use client";

import type { ReactNode } from "react";
import { DirectoryProvider } from "@/web/stores/directory";
import { NotificationsProvider } from "@/web/stores/notifications-store";
import { RealtimeProvider } from "@/web/realtime/realtime-provider";
import { SessionProvider } from "@/web/stores/session-store";
import { TimelineProvider } from "@/web/stores/timeline";
import { UiProvider } from "@/web/stores/ui-store";
import { I18nProvider, type Locale } from "@/web/lib/i18n";
import type { Session } from "@/web/types";

/** 组合各领域 store，顺序即依赖顺序：i18n → 会话 → 用户 → 时间线 → UI。 */
export function StoreProvider({
    initialSession,
    initialLocale,
    children,
}: {
    initialSession?: Session | null;
    initialLocale?: Locale;
    children: ReactNode;
}) {
    return (
        <I18nProvider initialLocale={initialLocale}>
            <SessionProvider initialSession={initialSession}>
                <DirectoryProvider>
                    <TimelineProvider>
                        <UiProvider>
                            <NotificationsProvider>
                                <RealtimeProvider>{children}</RealtimeProvider>
                            </NotificationsProvider>
                        </UiProvider>
                    </TimelineProvider>
                </DirectoryProvider>
            </SessionProvider>
        </I18nProvider>
    );
}
