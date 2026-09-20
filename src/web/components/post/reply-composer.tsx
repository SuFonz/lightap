"use client";

import { useState, type FormEvent } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { SendIcon } from "@/web/components/ui/icons";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline-store";
import { useUi } from "@/web/stores/ui-store";

/** 帖子详情页的内联回复框。 */
export function ReplyComposer({ postId }: { postId: string }) {
    const { isAuthenticated } = useSession();
    const { currentUser } = useDirectory();
    const { reply } = useTimeline();
    const { openAuth } = useUi();
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isAuthenticated) {
        return (
            <section className="glass-card flex items-center justify-between gap-3 p-4" aria-label="回复">
                <p className="text-sm font-semibold text-slate-500">登录后即可参与回复</p>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="btn-solid px-4 py-2 font-display text-sm font-bold"
                >
                    登录
                </button>
            </section>
        );
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const text = content.trim();
        if (!text || sending) return;
        setSending(true);
        setError(null);
        try {
            await reply(postId, text);
            setContent("");
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : "回复失败，请稍后重试");
        } finally {
            setSending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="glass-card p-4" aria-label="回复">
            <div className="flex gap-3">
                <Avatar
                    name={currentUser.displayName}
                    src={currentUser.avatarUrl}
                    size={42}
                    status={currentUser.online}
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="写下你的回复…"
                    aria-label="回复内容"
                    className="w-full resize-none rounded-xl border border-transparent bg-white/55 px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 transition focus:border-brand/40 focus:bg-white/85 focus:outline-none focus:ring-4 focus:ring-brand/15"
                />
            </div>

            {error && (
                <p role="alert" className="mt-3 rounded-lg bg-sakura/10 px-3 py-2 text-xs font-bold text-sakura-deep">
                    {error}
                </p>
            )}

            <div className="mt-3 flex items-center justify-end border-t border-white/70 pt-3">
                <button
                    type="submit"
                    disabled={!content.trim() || sending}
                    className="btn-solid px-5 py-2 font-display text-sm font-bold"
                >
                    {sending ? "发送中…" : "回复"}
                    <SendIcon size={15} />
                </button>
            </div>
        </form>
    );
}
