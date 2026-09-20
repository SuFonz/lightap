"use client";

import { useCallback, useEffect, useState } from "react";
import { readStorage, writeStorage } from "@/web/lib/storage";

const KEY = "search-history";
const MAX_ITEMS = 12;

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        setHistory(readStorage<string[]>(KEY, []));
    }, []);

    const add = useCallback((term: string) => {
        const value = term.trim();
        if (!value) return;
        setHistory((prev) => {
            const next = [value, ...prev.filter((item) => item !== value)].slice(0, MAX_ITEMS);
            writeStorage(KEY, next);
            return next;
        });
    }, []);

    const remove = useCallback((term: string) => {
        setHistory((prev) => {
            const next = prev.filter((item) => item !== term);
            writeStorage(KEY, next);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setHistory([]);
        writeStorage(KEY, []);
    }, []);

    return { history, add, remove, clear };
}
