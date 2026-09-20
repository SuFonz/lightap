"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoginRequiredPanel } from "@/web/components/auth/login-required-panel";
import { ComposerField } from "@/web/components/composer/composer-field";
import { PostCard } from "@/web/components/post/post-card";
import { ImageIcon, SparklesIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline-store";
import type { FeedTab } from "@/web/types";

export default function HomePage() {
    const { isAuthenticated } = useSession();
    const { currentUser, isFollowing } = useDirectory();
    const { posts, loading, loadFeed, compose } = useTimeline();
    const [tab, setTab] = useState<"all" | "following">("all");
    const [greeting, setGreeting] = useState("欢迎回来");

    useEffect(() => {
        const hour = new Date().getHours();
        setGreeting(hour < 5 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好");
    }, []);

    const feedTab: FeedTab = tab === "all" ? "all" : "following";

    useEffect(() => {
        void loadFeed(feedTab);
    }, [feedTab, loadFeed]);

    const visiblePosts = useMemo(() => {
        if (tab === "all") return posts;
        return posts.filter(
            (post) => post.authorUsername === currentUser.username || isFollowing(post.authorUsername),
        );
    }, [posts, tab, currentUser.username, isFollowing]);

    const handlePost = useCallback(
        async (content: string) => {
            await compose(content);
            await loadFeed(feedTab);
        },
        [compose, loadFeed, feedTab],
    );

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <SparklesIcon size={19} />
                </span>
                <div>
                    <h1 className="font-display text-lg font-black text-slate-800">
                        {isAuthenticated ? `${greeting}，${currentUser.displayName}～` : "欢迎来到 LightAP～"}
                    </h1>
                    <p className="text-xs font-medium text-slate-400">
                        {isAuthenticated
                            ? "今天联邦宇宙里也有有趣的事发生哦"
                            : "登录后即可发布动态，和联邦宇宙的伙伴们聊聊天"}
                    </p>
                </div>
            </section>

            {isAuthenticated ? <ComposerField onSubmit={handlePost} /> : <LoginRequiredPanel />}

            {isAuthenticated && (
                <div className="glass-card flex gap-1 p-1.5" role="tablist" aria-label="时间线切换">
                    {(
                        [
                            ["all", "全部"],
                            ["following", "已关注"],
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
            )}

            {/* 时间线：一个玻璃容器，内容优先 */}
            <section className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="时间线">
                {visiblePosts.map((post) => (
                    <PostCard key={post.id} post={post} bare />
                ))}
            </section>

            {visiblePosts.length === 0 && (
                <div className="glass-card flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <ImageIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">
                        {loading ? "加载中…" : "这里还什么都没有"}
                    </p>
                    <p className="text-sm text-slate-400">
                        {isAuthenticated ? "发第一条动态，让大家认识你吧！" : "登录后就能看到属于你的时间线啦～"}
                    </p>
                </div>
            )}
        </div>
    );
}
