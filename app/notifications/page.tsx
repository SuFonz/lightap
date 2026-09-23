"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LoginRequiredPanel } from "@/web/components/auth/login-required-panel";
import { Avatar } from "@/web/components/ui/avatar";
import { BellIcon } from "@/web/components/ui/icons";
import { RelativeTime } from "@/web/components/ui/relative-time";
import { normalizeNoteContent } from "@/web/lib/html";
import { useNotifications } from "@/web/stores/notifications-store";
import { useSession } from "@/web/stores/session-store";
import type { NotificationType } from "@/web/types";

const TYPE_TEXT: Record<NotificationType, string> = {
    Follow: "关注了你",
    Like: "赞了你的帖子",
    Reply: "回复了你的帖子",
    Mention: "在帖子中提到了你",
};

export default function NotificationsPage() {
    const { isAuthenticated } = useSession();
    const { items, loading, markAllRead } = useNotifications();

    // 进入通知页时标记全部已读（顺带刷新列表）
    useEffect(() => {
        void markAllRead();
    }, [markAllRead]);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="glass-card px-5 py-3 font-display text-lg font-black text-slate-800">通知</h1>

            {!isAuthenticated ? (
                <LoginRequiredPanel />
            ) : loading && items.length === 0 ? (
                <div className="glass-card flex items-center justify-center gap-2 px-6 py-14 text-slate-400">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-sm font-semibold">正在加载通知…</span>
                </div>
            ) : items.length === 0 ? (
                <div className="glass-card flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <BellIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">还没有通知</p>
                    <p className="text-sm text-slate-400">有人关注、点赞或回复你时会显示在这里～</p>
                </div>
            ) : (
                <ul className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="通知列表">
                    {items.map((item) => {
                        const name = item.user.displayName || item.user.username;
                        // Follow 跳到对方主页，Like/Reply 跳到相关帖子
                        const href = item.note ? `/post/${item.note.uuid}` : `/u/${item.user.username}`;

                        return (
                            <li key={item.id}>
                                <Link
                                    href={href}
                                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/45 sm:px-5"
                                >
                                    <Avatar name={name} src={item.user.avatarUrl || undefined} size={42} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] leading-relaxed text-slate-600">
                                            <span className="font-display font-extrabold text-slate-800">{name}</span>
                                            <span> {TYPE_TEXT[item.type]}</span>
                                        </p>
                                        {item.note && (
                                            <p className="mt-0.5 truncate text-xs text-slate-500">
                                                {normalizeNoteContent(item.note.content)}
                                            </p>
                                        )}
                                        <p className="mt-0.5 text-xs text-slate-400">
                                            <RelativeTime iso={new Date(item.createdAt * 1000).toISOString()} />
                                        </p>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
