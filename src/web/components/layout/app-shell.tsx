"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "@/web/stores/store-provider";
import { ShellFrame } from "@/web/components/layout/shell-frame";
import type { Locale } from "@/web/lib/i18n";
import type { Session } from "@/web/types";

/** 客户端根：装载各领域 store，再渲染三栏壳层。 */
export function AppShell({
    children,
    initialSession = null,
    initialLocale,
}: {
    children: ReactNode;
    initialSession?: Session | null;
    initialLocale?: Locale;
}) {
    return (
        <StoreProvider initialSession={initialSession} initialLocale={initialLocale}>
            <ShellFrame>{children}</ShellFrame>
        </StoreProvider>
    );
}
