"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ComposerField } from "@/components/composer-field";
import { ImageIcon, SparklesIcon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

export default function HomePage() {
    const { posts, currentUser, addPost } = useStore();
    const [tab, setTab] = useState<"all" | "following">("all");
    const [greeting, setGreeting] = useState("欢迎回来");

    useEffect(() => {
        const hour = new Date().getHours();
        setGreeting(hour < 5 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好");
    }, []);

    const followingOnly = posts.filter((p) => p.authorUsername !== "kuro" && p.authorUsername !== "taro");
    const visible = tab === "all" ? posts : followingOnly;

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <SparklesIcon size={19} />
                </span>
                <div>
                    <h1 className="font-display text-lg font-black text-slate-800">
                        {greeting}，{currentUser.displayName}～
                    </h1>
                    <p className="text-xs font-medium text-slate-400">
                        今天联邦宇宙里也有有趣的事发生哦
                    </p>
                </div>
            </section>

            <ComposerField onSubmit={addPost} />

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

            {/* 时间线：一个玻璃容器，内容优先 */}
            <section className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="时间线">
                {visible.map((post) => (
                    <PostCard key={post.id} post={post} bare />
                ))}
            </section>

            {visible.length === 0 && (
                <div className="glass-card flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <ImageIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">这里还什么都没有</p>
                    <p className="text-sm text-slate-400">
                        去 <Link href="/users" className="font-bold text-brand-deep hover:underline">用户浏览</Link> 找些有趣的人关注吧！
                    </p>
                </div>
            )}
        </div>
    );
}
