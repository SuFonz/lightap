"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { CloseIcon, SendIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useDirectory } from "@/web/stores/directory-store";
import { useTimeline } from "@/web/stores/timeline-store";

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
    const { currentUser } = useDirectory();
    const { compose } = useTimeline();
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!open) return;
        setContent("");
        setError(null);
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
        setError(null);
        try {
            if (onSubmit) await onSubmit(content.trim());
            else await compose(content.trim());
            onClose();
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "发送失败，请稍后重试");
        } finally {
            setSending(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-brand-ink/20 backdrop-blur-sm p-3 pt-[72px] sm:items-center sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="glass-strong w-full max-w-xl p-5"
                style={{ animation: "drop-in .32s cubic-bezier(.34,1.4,.64,1)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-extrabold text-slate-800">{title}</h2>
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={onClose}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-slate-400 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                <div className="flex gap-3">
                    <Avatar
                        name={currentUser.displayName}
                        src={currentUser.avatarUrl}
                        size={44}
                    />
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={4}
                        maxLength={maxLength + 50}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="w-full resize-none rounded-xl border border-transparent bg-white/55 px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 transition focus:border-brand/40 focus:bg-white/85 focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                </div>

                {error && (
                    <p role="alert" className="mt-3 rounded-lg bg-sakura/10 px-3 py-2 text-xs font-bold text-sakura-deep">
                        {error}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/80 pt-3 pl-14">
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
                        className="btn-solid px-5 py-2 font-display text-sm font-bold"
                    >
                        {sending ? "发送中…" : submitLabel}
                        <SendIcon size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
