"use client";

import { createContext, useContext } from "react";
import type { AuthMode } from "@/components/auth/auth-provider";

export interface ShellValue {
    openComposer: () => void;
    closeComposer: () => void;
    openEditProfile: () => void;
    openAuth: (mode: AuthMode) => void;
    drawerOpen: boolean;
    setDrawerOpen: (open: boolean) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell() {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error("useShell must be used within ShellContext");
    return ctx;
}
