"use client";

import { useEffect, useState } from "react";
import { useDirectory } from "@/web/stores/directory-store";
import type { User } from "@/web/types";

/** 按关键词搜索用户，结果同时会记入 directory store。 */
export function useSearchUsers(query: string) {
    const { search } = useDirectory();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const value = query.trim();
        if (!value) {
            setUsers([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        search(value)
            .then((result) => {
                if (cancelled) return;
                setUsers(result);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setUsers([]);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [query, search]);

    return { users, loading };
}
