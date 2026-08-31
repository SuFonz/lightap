"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { SearchBox } from "@/components/search/search-box";
import { SearchResultPanel } from "@/components/search/search-result-panel";
import { useSearchUsers } from "@/components/search/use-search-users";

function SearchPageInner() {
    const searchParams = useSearchParams();
    const query = (searchParams.get("q") ?? "").trim();
    const { users, loading } = useSearchUsers(query);

    return (
        <div className="flex flex-col gap-4">
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
                    <p className="font-display font-extrabold text-slate-700">搜索你想找的用户</p>
                    <p className="text-sm text-slate-400">输入用户名、昵称或简介，找到感兴趣的朋友～</p>
                </section>
            )}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="glass-card p-5 text-center text-sm text-slate-400">加载中…</div>}>
            <SearchPageInner />
        </Suspense>
    );
}
