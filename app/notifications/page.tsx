"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentType } from "react";
import { Avatar } from "@/components/avatar";
import {
    AtIcon,
    BellIcon,
    BoostIcon,
    CheckIcon,
    HeartIcon,
    UserPlusIcon,
} from "@/components/icons";
import { RelativeTime } from "@/components/relative-time";
import { useStore } from "@/components/store";
import type { NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeMeta: Record<
    NotificationType,
    { verb: string; icon: ComponentType<{ size?: number }>; classes: string }
> = {
    follow: {
        verb: "关注了你",
        icon: UserPlusIcon,
        classes: "bg-brand/15 text-brand-deep",
    },
    like: {
        verb: "喜欢了你的帖子",
        icon: HeartIcon,
        classes: "bg-sakura/20 text-sakura-deep",
    },
    boost: {
        verb: "转发了你的帖子",
        icon: BoostIcon,
        classes: "bg-magic/15 text-magic-deep",
    },
    mention: {
        verb: "在帖子中提到了你",
        icon: AtIcon,
        classes: "bg-brand/15 text-brand-ink",
    },
};

type Tab = "all" | "unread" | "mentions";

export default function NotificationsPage() {
    const { notifications, getUser, currentUser, markAllNotificationsRead } = useStore();
    const [tab, setTab] = useState<Tab>("all");

    const visible = notifications.filter((n) => {
        if (tab === "unread") return !n.read;
        if (tab === "mentions") return n.type === "mention";
        return true;
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <BellIcon size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-sakura px-1 py-0.5 text-[10px] font-black text-white ring-2 ring-white">
                            {unreadCount}
                        </span>
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <h1 className="font-display text-lg font-black text-slate-800">通知</h1>
                    <p className="text-xs font-medium text-slate-400">
                        {unreadCount > 0 ? `有 ${unreadCount} 条新消息等你查看` : "所有消息都已读啦～"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    disabled={unreadCount === 0}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-white/80 bg-white/60 px-3.5 py-2 text-xs font-bold text-brand-deep transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/60"
                >
                    <CheckIcon size={13} /> 全部已读
                </button>
            </section>

            <div className="glass-card flex gap-1 p-1.5" role="tablist" aria-label="通知筛选">
                {(
                    [
                        ["all", "全部"],
                        ["unread", "未读"],
                        ["mentions", "@提及"],
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

            {visible.length === 0 ? (
                <div className="glass-card px-6 py-14 text-center">
                    <p className="font-display font-extrabold text-slate-700">这里空空的～</p>
                    <p className="mt-1 text-sm text-slate-400">发个帖子让大家来找你玩吧！</p>
                </div>
            ) : (
                <ul className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="通知列表">
                    {visible.map((n) => {
                        const actor = getUser(n.actorUsername);
                        if (!actor) return null;
                        const meta = typeMeta[n.type];
                        const IconCmp = meta.icon;
                        const href =
                            n.type === "mention" && n.postId
                                ? `/u/${currentUser.username}`
                                : `/u/${actor.username}`;
                        return (
                            <li key={n.id}>
                                <Link
                                    href={href}
                                    className={cn(
                                        "relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/45 sm:px-5",
                                        !n.read && "bg-white/40",
                                    )}
                                >
                                    {!n.read && (
                                        <span
                                            className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-brand to-magic"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="relative shrink-0">
                                        <Avatar name={actor.displayName} src={actor.avatarUrl} size={44} status={actor.online} />
                                        <span
                                            className={cn(
                                                "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white",
                                                meta.classes,
                                            )}
                                            aria-hidden="true"
                                        >
                                            <IconCmp size={11} />
                                        </span>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm">
                                            <span className="font-display font-extrabold text-slate-800">
                                                {actor.displayName}
                                            </span>{" "}
                                            <span className="text-slate-500">{meta.verb}</span>
                                        </span>
                                        {n.excerpt && (
                                            <span className="mt-0.5 block truncate text-xs text-slate-400">
                                                「{n.excerpt}」
                                            </span>
                                        )}
                                    </span>
                                    <RelativeTime
                                        iso={n.createdAt}
                                        className="shrink-0 text-xs text-slate-300 tabular-nums"
                                    />
                                    {!n.read && (
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-brand to-magic"
                                            aria-label="未读"
                                        />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
