"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { SearchIcon, UserPlusIcon, UsersIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { pillTones, TagPill } from "@/components/tag-pill";
import { cn, formatCount } from "@/lib/utils";

type Filter = "all" | "following" | "notFollowing";

export default function UsersPage() {
    const { users, currentUser, isFollowing } = useStore();
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((user) => {
            if (user.username === currentUser.username) return false;
            if (filter === "following" && !isFollowing(user.username)) return false;
            if (filter === "notFollowing" && isFollowing(user.username)) return false;
            if (
                q &&
                !user.displayName.toLowerCase().includes(q) &&
                !user.username.toLowerCase().includes(q)
            ) {
                return false;
            }
            return true;
        });
    }, [users, filter, query, isFollowing, currentUser.username]);

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <UsersIcon size={18} />
                </span>
                <div>
                    <h1 className="font-display text-lg font-black text-slate-800">探索</h1>
                    <p className="text-xs font-medium text-slate-400">
                        发现联邦宇宙里的有趣伙伴，本站与远端用户都在这里
                    </p>
                </div>
            </section>

            <section className="glass-card p-4">
                <label className="flex items-center gap-2.5 rounded-full border border-white/70 bg-white/70 px-4 py-2.5 transition focus-within:border-brand/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/15">
                    <SearchIcon size={16} className="shrink-0 text-brand" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="按昵称或用户名筛选…"
                        aria-label="筛选用户"
                        className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    />
                </label>

                <div className="mt-3 flex gap-1 rounded-[10px] bg-brand/10 p-1" role="tablist" aria-label="关注状态筛选">
                    {(
                        [
                            ["all", "全部"],
                            ["notFollowing", "未关注"],
                            ["following", "已关注"],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={filter === key}
                            onClick={() => setFilter(key)}
                            className={cn(
                                "flex-1 cursor-pointer rounded-[10px] py-1.5 font-display text-xs font-bold transition-all duration-200",
                                filter === key
                                    ? "bg-brand text-white shadow-[0_4px_12px_-4px_rgba(59,167,255,0.55)]"
                                    : "text-slate-500 hover:text-brand-deep",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            {visible.length === 0 ? (
                <div className="glass-card px-6 py-14 text-center">
                    <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <UserPlusIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">没有匹配的用户</p>
                    <p className="mt-1 text-sm text-slate-400">换个筛选条件试试吧～</p>
                </div>
            ) : (
                <ul className="rise-in grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {visible.map((user) => (
                        <li
                            key={user.username}
                            className="glass-card p-4 transition-shadow duration-200 hover:shadow-glow"
                        >
                            <div className="flex items-start gap-3">
                                <Avatar name={user.displayName} src={user.avatarUrl} size={50} ring status={user.online} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p className="truncate font-display text-[15px] font-extrabold text-slate-800">
                                            {user.displayName}
                                        </p>
                                        {user.badges?.slice(0, 2).map((badge, i) => (
                                            <TagPill
                                                key={badge}
                                                label={badge}
                                                tone={pillTones[(i + 1) % pillTones.length]}
                                                className="text-[11px] leading-4"
                                            />
                                        ))}
                                    </div>
                                    <p className="truncate text-xs text-slate-400">
                                        @{user.username}
                                        {user.instance !== "lightap.social" && `@${user.instance}`}
                                    </p>
                                </div>
                                <FollowButton username={user.username} size="sm" />
                            </div>
                            <p className="mt-2.5 line-clamp-2 min-h-10 text-[13px] leading-relaxed text-slate-500">
                                {user.bio}
                            </p>
                            <dl className="mt-3 flex gap-4 border-t border-sky-100/80 pt-3 text-xs text-slate-400">
                                <div className="flex gap-1">
                                    <dt>帖子</dt>
                                    <dd className="font-bold text-slate-600 tabular-nums">{formatCount(user.postsCount)}</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>关注</dt>
                                    <dd className="font-bold text-slate-600 tabular-nums">{formatCount(user.followingCount)}</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>粉丝</dt>
                                    <dd className="font-bold text-slate-600 tabular-nums">{formatCount(user.followers)}</dd>
                                </div>
                            </dl>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
