"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CloseIcon, HashIcon, ImageIcon, SendIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

interface ComposerModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    submitLabel?: string;
    placeholder?: string;
    maxLength?: number;
    showTips?: boolean;
    onSubmit?: (content: string) => Promise<void> | void;
}

export function ComposerModal({
    open,
    onClose,
    title = "发布新帖",
    submitLabel = "发布",
    placeholder = "今天有什么开心的事呀？用 #话题 和大家分享吧～",
    maxLength = 500,
    showTips = true,
    onSubmit,
}: ComposerModalProps) {
    const { currentUser, addPost } = useStore();
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!open) return;
        setContent("");
        const t = setTimeout(() => textareaRef.current?.focus(), 60);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(t);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    const remaining = maxLength - content.length;
    const overLimit = remaining < 0;
    const canSend = content.trim().length > 0 && !overLimit && !sending;

    async function handleSend() {
        if (!canSend) return;
        setSending(true);
        try {
            if (onSubmit) await onSubmit(content.trim());
            else await addPost(content.trim());
            onClose();
        } finally {
            setSending(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-blue-950/25 backdrop-blur-sm p-3 pt-[72px] sm:items-center sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="glass-strong w-full max-w-xl rounded-[28px] p-5"
                style={{ animation: "drop-in .32s cubic-bezier(.34,1.4,.64,1)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-extrabold text-slate-800">{title}</h2>
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={onClose}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-white/80 hover:text-sky-600"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                <div className="flex gap-3">
                    <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={44} />
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={4}
                        maxLength={maxLength + 50}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="w-full resize-none rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-200/60"
                    />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
                    {showTips && (
                        <>
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
                        </>
                    )}
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
                        onClick={handleSend}
                        disabled={!canSend}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                    >
                        {sending ? "发送中…" : submitLabel}
                        <SendIcon size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
