"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { CloseIcon, SearchIcon, TrendingUpIcon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { useStore } from "@/stores/store";
import { pillTones, TagPill, toneClasses } from "@/components/tag-pill";
import { cn, formatCount } from "@/lib/client/utils";

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
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                        <SearchIcon size={17} />
                    </span>
                    搜索
                </h1>

                <form onSubmit={handleSubmit} role="search" className="relative">
                    <SearchIcon
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand"
                    />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索帖子、用户、#话题…"
                        aria-label="搜索关键词"
                        autoFocus
                        className="w-full rounded-full border border-white/70 bg-white/70 py-3 pl-11 pr-11 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="清空搜索"
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-brand/10 hover:text-brand-deep"
                        >
                            <CloseIcon size={15} />
                        </button>
                    )}
                </form>

                {!hasQuery && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">最近搜索：</span>
                        {recentSearches.map((term, i) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => setQuery(term)}
                                className={cn(
                                    "cursor-pointer rounded-full px-3 py-1 text-xs font-bold ring-1 ring-white/80 transition active:scale-95",
                                    toneClasses[pillTones[i % pillTones.length]],
                                )}
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
                        <TrendingUpIcon size={16} className="text-sakura-deep" /> 大家都在搜
                    </h2>
                    <ul className="flex flex-col">
                        {trends.map((trend, i) => (
                            <li key={trend.name}>
                                <button
                                    type="button"
                                    onClick={() => setQuery(trend.name)}
                                    className="-mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/60"
                                >
                                    <span className="w-6 shrink-0 text-center font-display text-base font-black text-brand/50 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <TagPill label={`#${trend.name}`} tone={pillTones[i % pillTones.length]} />
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
                                    "flex-1 cursor-pointer rounded-[10px] py-2 font-display text-sm font-bold transition-all duration-200",
                                    tab === key
                                        ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(59,167,255,0.55)]"
                                        : "text-slate-500 hover:bg-white/70 hover:text-brand-deep",
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
                        <section className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="帖子结果">
                            {postResults.map((post) => (
                                <PostCard key={post.id} post={post} bare />
                            ))}
                        </section>
                    )}

                    {tab === "users" && (
                        <ul className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="用户结果">
                            {userResults.map((user) => (
                                <li key={user.username} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/45 sm:px-5">
                                    <Avatar name={user.displayName} src={user.avatarUrl} size={44} status={user.online} />
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
                        <ul className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="话题结果">
                            {tagResults.map((trend) => (
                                <li key={trend.name}>
                                    <button
                                        type="button"
                                        onClick={() => setQuery(trend.name)}
                                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/45 sm:px-5"
                                    >
                                        <TagPill label={`#${trend.name}`} />
                                        <span className="ml-auto text-xs text-slate-400 tabular-nums">
                                            {formatCount(trend.postsCount)} 条帖子
                                        </span>
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
