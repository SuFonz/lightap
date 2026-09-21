"use client";

import { useEffect } from "react";

/** 监听 Escape 键；enabled 为 false 时不监听。 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
    useEffect(() => {
        if (!enabled) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onEscape();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onEscape, enabled]);
}
