"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { CloseIcon, HashIcon, SearchIcon, TrendingUpIcon, UserPlusIcon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { useStore } from "@/components/store";
import { cn, formatCount } from "@/lib/utils";

type Tab = "posts" | "users" | "tags";

const recentSearches = ["插画", "ActivityPub", "雪宝", "游戏开发"];

export default function SearchPage() {
    const router = useRouter();
    const { posts, users, trends } = useStore();
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<Tab>("posts");

    useEffect(() => {
        const initial = new URLSearchParams(window.location.search).get("q") ?? "";
        setQuery(initial);
    }, []);

    const q = query.trim().toLowerCase();

    const postResults = useMemo(
        () =>
            q
                ? posts.filter((p) => {
                      const author = users.find((u) => u.username === p.authorUsername);
                      return (
                          p.content.toLowerCase().includes(q) ||
                          author?.displayName.toLowerCase().includes(q) ||
                          author?.username.toLowerCase().includes(q)
                      );
                  })
                : [],
        [q, posts, users],
    );

    const userResults = useMemo(
        () =>
            q
                ? users.filter(
                      (u) =>
                          u.displayName.toLowerCase().includes(q) ||
                          u.username.toLowerCase().includes(q) ||
                          u.bio.toLowerCase().includes(q),
                  )
                : [],
        [q, users],
    );

    const tagResults = useMemo(
        () => (q ? trends.filter((t) => t.name.toLowerCase().includes(q)) : []),
        [q, trends],
    );

    const hasQuery = q.length > 0;
    const totalResults = postResults.length + userResults.length + tagResults.length;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        router.replace(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search");
    }

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card p-4">
                <h1 className="mb-3 flex items-center gap-2 font-display text-lg font-black text-slate-800">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/30">
                        <SearchIcon size={17} />
                    </span>
                    搜索
                </h1>

                <form onSubmit={handleSubmit} role="search" className="relative">
                    <SearchIcon
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-400"
                    />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索帖子、用户、#话题…"
                        aria-label="搜索关键词"
                        autoFocus
                        className="w-full rounded-full border border-white/70 bg-white/70 py-3 pl-11 pr-11 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-200/60"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="清空搜索"
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                        >
                            <CloseIcon size={15} />
                        </button>
                    )}
                </form>

                {!hasQuery && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">最近搜索：</span>
                        {recentSearches.map((term) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => setQuery(term)}
                                className="cursor-pointer rounded-full border border-dashed border-sky-300 bg-sky-50/60 px-3 py-1 text-xs font-bold text-sky-500 transition hover:border-sky-400 hover:bg-sky-100 active:scale-95"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {!hasQuery ? (
                <section className="glass-card p-5" aria-label="热门话题">
                    <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
                        <TrendingUpIcon size={16} className="text-pink-400" /> 大家都在搜
                    </h2>
                    <ul className="flex flex-col gap-1.5">
                        {trends.map((trend, i) => (
                            <li key={trend.name}>
                                <button
                                    type="button"
                                    onClick={() => setQuery(trend.name)}
                                    className="-mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-white/80"
                                >
                                    <span className="w-6 shrink-0 text-center font-display text-base font-black text-sky-300 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <HashIcon size={15} className="shrink-0 text-blue-400" />
                                    <span className="font-display text-sm font-bold text-slate-700">#{trend.name}</span>
                                    <span className="ml-auto text-xs text-slate-400 tabular-nums">
                                        {formatCount(trend.postsCount)} 条帖子
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                <>
                    <div className="glass-card flex gap-1 p-1.5" role="tablist" aria-label="结果类型">
                        {(
                            [
                                ["posts", `帖子 ${postResults.length}`],
                                ["users", `用户 ${userResults.length}`],
                                ["tags", `话题 ${tagResults.length}`],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => setTab(key)}
                                className={cn(
                                    "flex-1 cursor-pointer rounded-xl py-2 font-display text-sm font-bold transition-all duration-200",
                                    tab === key
                                        ? "bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/25"
                                        : "text-slate-500 hover:bg-white/70 hover:text-sky-600",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {totalResults === 0 && (
                        <div className="glass-card px-6 py-14 text-center">
                            <p className="font-display font-extrabold text-slate-700">没有找到「{query.trim()}」</p>
                            <p className="mt-1 text-sm text-slate-400">换个关键词试试，或者去热门话题逛逛～</p>
                        </div>
                    )}

                    {tab === "posts" && (
                        <div className="rise-in flex flex-col gap-4">
                            {postResults.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    )}

                    {tab === "users" && (
                        <ul className="rise-in flex flex-col gap-3">
                            {userResults.map((user) => (
                                <li key={user.username} className="glass-card flex items-center gap-3 p-4">
                                    <Avatar name={user.displayName} src={user.avatarUrl} size={46} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-display text-[15px] font-extrabold text-slate-800">
                                            {user.displayName}
                                        </p>
                                        <p className="truncate text-xs text-slate-400">
                                            @{user.username}@{user.instance}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">{user.bio}</p>
                                    </div>
                                    <FollowButton username={user.username} />
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === "tags" && (
                        <ul className="rise-in flex flex-col gap-3">
                            {tagResults.map((trend) => (
                                <li key={trend.name}>
                                    <button
                                        type="button"
                                        onClick={() => setQuery(trend.name)}
                                        className="glass-card flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glow"
                                    >
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-blue-500">
                                            <HashIcon size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-display text-sm font-extrabold text-slate-700">
                                                #{trend.name}
                                            </span>
                                            <span className="block text-xs text-slate-400">
                                                {formatCount(trend.postsCount)} 条帖子
                                            </span>
                                        </span>
                                        <UserPlusIcon size={16} className="text-sky-300" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
