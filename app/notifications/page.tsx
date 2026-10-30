"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LoginRequiredPanel } from "@/web/components/auth/login-required-panel";
import { Avatar } from "@/web/components/ui/avatar";
import { BellIcon } from "@/web/components/ui/icons";
import { RelativeTime } from "@/web/components/ui/relative-time";
import { normalizeNoteContent } from "@/web/lib/html";
import { useI18n, type TranslationKey } from "@/web/lib/i18n";
import { profileHref } from "@/web/lib/user";
import { useNotifications } from "@/web/stores/notifications-store";
import { useSession } from "@/web/stores/session-store";
import type { NotificationType } from "@/web/types";

const TYPE_KEY: Record<NotificationType, TranslationKey> = {
    Follow: "notifications.follow",
    Like: "notifications.like",
    Reply: "notifications.reply",
    Mention: "notifications.mention",
};

export default function NotificationsPage() {
    const { isAuthenticated } = useSession();
    const { items, loading, markAllRead } = useNotifications();
    const { t } = useI18n();

    // 进入通知页时标记全部已读（顺带刷新列表）
    useEffect(() => {
        void markAllRead();
    }, [markAllRead]);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="row-quiet px-5 py-3 font-display text-lg font-black text-fg">{t("notifications.title")}</h1>

            {!isAuthenticated ? (
                <LoginRequiredPanel />
            ) : loading && items.length === 0 ? (
                <div className="row-quiet flex items-center justify-center gap-2 px-6 py-14 text-fg-mute">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-sm font-semibold">{t("notifications.loading")}</span>
                </div>
            ) : items.length === 0 ? (
                <div className="row-quiet flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <BellIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-fg">{t("notifications.empty")}</p>
                    <p className="text-sm text-fg-mute">{t("notifications.emptyHint")}</p>
                </div>
            ) : (
                <ul className="row-quiet rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label={t("notifications.title")}>
                    {items.map((item, index) => {
                        const name = item.user.displayName || item.user.username;
                        // Follow 跳到对方主页，Like/Reply 跳到相关帖子
                        const href = item.note
                            ? `/notes/${item.note.uuid}`
                            : profileHref({ username: item.user.username, domain: item.user.domain });

                        return (
                            <li
                                key={item.id}
                                // 依次入场：每项晚 40ms，最多错 8 项（更长的列表等下去会不耐烦）
                                className="stagger-in"
                                style={{ "--stagger": `${Math.min(index, 8) * 40}ms` } as React.CSSProperties}
                            >
                                <Link
                                    href={href}
                                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-overlay-weak sm:px-5"
                                >
                                    <Avatar name={name} src={item.user.avatarUrl || undefined} size={42} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] leading-relaxed text-fg-weak">
                                            <span className="font-display font-extrabold text-fg">{name}</span>
                                            <span> {t(TYPE_KEY[item.type])}</span>
                                        </p>
                                        {item.note && (
                                            <p className="mt-0.5 truncate text-xs text-fg-weak">
                                                {normalizeNoteContent(item.note.content)}
                                            </p>
                                        )}
                                        <p className="mt-0.5 text-xs text-fg-mute">
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
