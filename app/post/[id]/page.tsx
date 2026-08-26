"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { PostCard } from "@/components/post-card";
import { HomeIcon, ReplyIcon, SendIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

const MAX_REPLY = 500;

export default function PostDetailPage() {
    const params = useParams<{ id: string }>();
    const id = typeof params?.id === "string" ? params.id : "";
    const { getPostPath, addReply, currentUser } = useStore();
    const router = useRouter();
    const chain = id ? getPostPath(id) ?? [] : [];

    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [focusReply, setFocusReply] = useState(false);

    useEffect(() => {
        if (focusReply) {
            textareaRef.current?.focus();
            setFocusReply(false);
        }
    }, [focusReply]);

    if (chain.length === 0) {
        return (
            <div className="glass-card mx-auto mt-10 max-w-md px-6 py-16 text-center">
                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-400">
                    <ReplyIcon size={26} />
                </span>
                <h1 className="font-display text-lg font-black text-slate-800">帖子不存在</h1>
                <p className="mt-1 text-sm text-slate-400">这个帖子可能已经被删除了～</p>
                <Link
                    href="/"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                    <HomeIcon size={15} /> 回到首页
                </Link>
            </div>
        );
    }

    const post = chain[chain.length - 1];
    const isThread = chain.length > 1;
    const postId = post.id;
    const remaining = MAX_REPLY - content.length;
    const canSend = content.trim().length > 0 && remaining >= 0 && !sending;
    const replies = [...post.replies].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    async function handleSend() {
        if (!canSend) return;
        setSending(true);
        try {
            await addReply(postId, content.trim());
            setContent("");
            setFocusReply(true);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="返回"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-sky-600 active:scale-90"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </button>
                <h1 className="font-display text-lg font-black text-slate-800">
                    {isThread ? "回复详情" : "帖子详情"}
                </h1>
                {isThread && (
                    <span className="ml-auto rounded-full bg-sky-100/80 px-2.5 py-1 text-[11px] font-bold text-sky-500">
                        上下文线程 · {chain.length} 层
                    </span>
                )}
            </section>

            <div className="flex flex-col gap-3">
                {chain.map((item, idx) => {
                    const isCurrent = idx === chain.length - 1;
                    return (
                        <div key={item.id} className="flex flex-col gap-3">
                            {idx > 0 && <ThreadConnector />}
                            <PostCard post={item} variant={isCurrent ? "default" : "context"} />
                        </div>
                    );
                })}
            </div>

            <section className="glass-card p-4" aria-label="回复">
                <div className="flex gap-3">
                    <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={40} />
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={3}
                        maxLength={MAX_REPLY}
                        placeholder={`回复一下 @${post.authorUsername} 吧～`}
                        aria-label="回复内容"
                        className="w-full resize-none rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-200/60"
                    />
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <span
                        className={cn(
                            "ml-auto text-xs font-bold tabular-nums",
                            remaining < 0 ? "text-red-500" : remaining <= 50 ? "text-amber-500" : "text-slate-400",
                        )}
                        aria-live="polite"
                    >
                        {remaining}
                    </span>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!canSend}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                    >
                        {sending ? "发送中…" : "发表回复"}
                        <SendIcon size={15} />
                    </button>
                </div>
            </section>

            <h2 className="glass-card px-5 py-3 font-display text-sm font-extrabold text-slate-700">
                回复 · {post.replies.length}
            </h2>

            {replies.length === 0 ? (
                <div className="glass-card px-6 py-12 text-center">
                    <p className="font-display font-extrabold text-slate-700">还没有回复</p>
                    <p className="mt-1 text-sm text-slate-400">来抢沙发，说点什么吧～</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {replies.map((reply) => (
                        <PostCard key={reply.id} post={reply} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ThreadConnector() {
    return (
        <div className="flex h-4 items-center pl-[42px]" aria-hidden="true">
            <span className="h-full w-px bg-gradient-to-b from-sky-200 to-sky-300" />
        </div>
    );
}
