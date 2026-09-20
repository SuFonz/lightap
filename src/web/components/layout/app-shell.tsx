"use client";

import type { ReactNode } from "react";
import { StoreProvider } from "@/web/stores/store-provider";
import type { Session } from "@/web/types";
import { ShellFrame } from "@/web/components/layout/shell-frame";

/** 客户端根：装载各领域 store，再渲染三栏壳层。 */
export function AppShell({
    children,
    initialSession = null,
}: {
    children: ReactNode;
    initialSession?: Session | null;
}) {
    return (
        <StoreProvider initialSession={initialSession}>
            <ShellFrame>{children}</ShellFrame>
        </StoreProvider>
    );
}
