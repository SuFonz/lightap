"use client";

import { useEffect, useState } from "react";
import { searchUsers } from "@/lib/client/api";
import type { User } from "@/lib/types/http";

export function useSearchUsers(query: string) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setUsers([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        searchUsers(q)
            .then((result) => {
                if (!cancelled) {
                    setUsers(result);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUsers([]);
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [query]);

    return { users, loading };
}
