"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lightap:search-history";
const MAX_ITEMS = 12;

function readHistory(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string")
            : [];
    } catch {
        return [];
    }
}

function writeHistory(items: string[]) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        // localStorage 不可用时静默忽略
    }
}

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        setHistory(readHistory());
    }, []);

    const add = useCallback((term: string) => {
        const t = term.trim();
        if (!t) return;
        setHistory((prev) => {
            const next = [t, ...prev.filter((x) => x !== t)].slice(0, MAX_ITEMS);
            writeHistory(next);
            return next;
        });
    }, []);

    const remove = useCallback((term: string) => {
        setHistory((prev) => {
            const next = prev.filter((x) => x !== term);
            writeHistory(next);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setHistory([]);
        writeHistory([]);
    }, []);

    return { history, add, remove, clear };
}
