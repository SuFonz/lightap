"use client";

import { UserResultList } from "@/web/components/search/user-result-list";
import { UsersIcon } from "@/web/components/ui/icons";
import { useI18n } from "@/web/lib/i18n";
import type { User } from "@/web/types";

interface SearchResultPanelProps {
    query: string;
    users: User[];
    loading: boolean;
}

export function SearchResultPanel({ query, users, loading }: SearchResultPanelProps) {
    const { t } = useI18n();

    if (loading) {
        return (
            <div className="glass-card flex items-center justify-center gap-2 px-6 py-14 text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <span className="text-sm font-semibold">{t("search.searching", { query })}</span>
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="glass-card flex flex-col items-center gap-2 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <UsersIcon size={24} />
                </span>
                <p className="font-display font-extrabold text-slate-700">{t("search.notFound", { query })}</p>
                <p className="text-sm text-slate-400">{t("search.notFoundHint")}</p>
            </div>
        );
    }

    return <UserResultList users={users} />;
}
