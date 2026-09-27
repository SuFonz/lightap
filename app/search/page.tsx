"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchResultPanel } from "@/web/components/search/search-result-panel";
import { SearchBox } from "@/web/components/search/search-box";
import { SearchIcon } from "@/web/components/ui/icons";
import { useI18n } from "@/web/lib/i18n";
import { useSearchUsers } from "@/web/hooks/use-search-users";

function SearchPageInner() {
    const searchParams = useSearchParams();
    const query = (searchParams.get("q") ?? "").trim();
    const { users, loading } = useSearchUsers(query);
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-display text-lg font-black text-slate-800">{t("search.title")}</h1>

            {/* 桌面端搜索框在右上角侧栏里；窄屏下由这里的搜索框兜底 */}
            <section className="glass-card p-4 xl:hidden">
                <SearchBox autoFocus />
            </section>

            {query ? (
                <SearchResultPanel query={query} users={users} loading={loading} />
            ) : (
                <section className="glass-card flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <SearchIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">{t("search.emptyTitle")}</p>
                    <p className="text-sm text-slate-400">{t("search.emptyHint")}</p>
                </section>
            )}
        </div>
    );
}

export default function SearchPage() {
    const { t } = useI18n();

    return (
        <Suspense fallback={<div className="glass-card p-5 text-center text-sm text-slate-400">{t("common.loading")}</div>}>
            <SearchPageInner />
        </Suspense>
    );
}
