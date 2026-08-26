"use client";

import { createContext, useContext } from "react";

export interface ShellValue {
    openComposer: () => void;
    closeComposer: () => void;
    openEditProfile: () => void;
    drawerOpen: boolean;
    setDrawerOpen: (open: boolean) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell() {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error("useShell must be used within ShellContext");
    return ctx;
}
