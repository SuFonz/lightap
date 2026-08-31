"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { GlobeIcon, SearchIcon, SparklesIcon } from "@/components/icons";
import { useStore } from "@/stores/store";
import { pillTones, TagPill } from "@/components/tag-pill";
import { formatCount } from "@/lib/client/utils";

export function RightRail() {
    const router = useRouter();
    const { trends, users, currentUser, isFollowing } = useStore();
    const [query, setQuery] = useState("");

    const suggestions = users
        .filter((u) => u.username !== currentUser.username && !isFollowing(u.username))
        .slice(0, 3);

    function handleSearch(e: FormEvent) {
        e.preventDefault();
        const q = query.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    }

    return (
        <aside
            className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[280px] shrink-0 flex-col gap-4 self-start overflow-y-auto scrollbar-none xl:flex"
            aria-label="标签栏"
        >
            <form onSubmit={handleSearch} role="search">
                <label className="glass-card flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-shadow focus-within:shadow-glow">
                    <SearchIcon size={17} className="shrink-0 text-brand" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索帖子、用户、话题…"
                        aria-label="搜索"
                        className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    />
                </label>
            </form>

            <section className="glass-card p-4" aria-label="热门标签">
                <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
                    <SparklesIcon size={15} className="text-magic-deep" /> 热门话题
                </h2>
                <ul className="flex flex-col">
                    {trends.map((trend, i) => (
                        <li key={trend.name}>
                            <Link
                                href={`/search?q=${encodeURIComponent(trend.name)}`}
                                className="group -mx-2 flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/60"
                            >
                                <TagPill
                                    label={`#${trend.name}`}
                                    tone={pillTones[i % pillTones.length]}
                                />
                                <span className="ml-auto shrink-0 text-xs text-slate-400 tabular-nums">
                                    {formatCount(trend.postsCount)} 条
                                </span>
                                {i < 2 && (
                                    <span className="shrink-0 rounded-full bg-sakura/20 px-2 py-0.5 text-[10px] font-extrabold text-sakura-deep">
                                        HOT
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="glass-card p-4" aria-label="推荐关注">
                <h2 className="mb-3 font-display text-sm font-extrabold text-slate-700">推荐关注</h2>
                <ul className="flex flex-col gap-3">
                    {suggestions.map((user) => (
                        <li key={user.username} className="flex items-center gap-2.5">
                            <Link
                                href={`/u/${user.username}`}
                                className="flex min-w-0 flex-1 items-center gap-2.5"
                            >
                                <Avatar
                                    name={user.displayName}
                                    src={user.avatarUrl}
                                    size={38}
                                    status={user.online}
                                />
                                <span className="min-w-0">
                                    <span className="block truncate font-display text-[13px] font-bold text-slate-700 hover:text-brand-deep">
                                        {user.displayName}
                                    </span>
                                    <span className="block truncate text-xs text-slate-400">
                                        @{user.username}
                                    </span>
                                </span>
                            </Link>
                            <FollowButton username={user.username} size="sm" />
                        </li>
                    ))}
                </ul>
            </section>

            <p className="flex items-start justify-center gap-1.5 px-2 pb-4 text-center text-[11px] leading-relaxed text-slate-400/90">
                <GlobeIcon size={12} className="mt-0.5 shrink-0" />
                基于 ActivityPub 协议 · 与 Mastodon / Misskey / Pleroma 互联互通
            </p>
        </aside>
    );
}
