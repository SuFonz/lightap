"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CloseIcon, HashIcon, ImageIcon, SendIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 500;

interface InlineComposerProps {
    onClose: () => void;
    onPosted?: () => void;
    autoFocus?: boolean;
}

export function InlineComposer({ onClose, onPosted, autoFocus = true }: InlineComposerProps) {
    const { currentUser, addPost } = useStore();
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoFocus) textareaRef.current?.focus();
    }, [autoFocus]);

    const remaining = MAX_LENGTH - content.length;
    const overLimit = remaining < 0;
    const canSend = content.trim().length > 0 && !overLimit && !sending;

    async function handleSend() {
        if (!canSend) return;
        setSending(true);
        try {
            await addPost(content.trim());
            setContent("");
            onPosted?.();
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="glass-card p-4" aria-label="发布新帖">
            <div className="flex gap-3">
                <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={42} />
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    maxLength={MAX_LENGTH + 50}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") onClose();
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="今天有什么开心的事呀？用 #话题 和大家分享吧～"
                    aria-label="帖子内容"
                    className="w-full resize-none rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-200/60"
                />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-500">
                    <HashIcon size={12} /> 话题标签
                </span>
                <button
                    type="button"
                    aria-label="添加图片（占位）"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-white/80 hover:text-pink-500"
                >
                    <ImageIcon size={17} />
                </button>
                <span
                    className={cn(
                        "ml-auto text-xs font-bold tabular-nums",
                        overLimit ? "text-red-500" : remaining <= 50 ? "text-amber-500" : "text-slate-400",
                    )}
                    aria-live="polite"
                >
                    {remaining}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-200 bg-white/60 px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 active:scale-95"
                >
                    <CloseIcon size={13} /> 收起
                </button>
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                >
                    {sending ? "发送中…" : "发布"}
                    <SendIcon size={15} />
                </button>
            </div>
        </div>
    );
}
