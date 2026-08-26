"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { BoostIcon, HeartIcon, MoreIcon, ReplyIcon, ShareIcon } from "@/components/icons";
import { RelativeTime } from "@/components/relative-time";
import { useStore } from "@/components/store";
import type { Post } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export function PostCard({ post, variant = "default" }: { post: Post; variant?: "default" | "context" }) {
    const { getUser, toggleLike, toggleBoost, currentUser } = useStore();
    const router = useRouter();
    const author = getUser(post.authorUsername);
    const isMine = post.authorUsername === currentUser.username;
    const detailHref = `/post/${post.id}`;
    const isContext = variant === "context";

    const openDetail = useCallback(() => router.push(detailHref), [router, detailHref]);
    const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    const renderContent = (content: string): ReactNode[] => {
        const parts = content.split(/(#[^\s#]+|@[^\s@]+)/g);
        return parts.map((part, i) => {
            if (/^#[^\s#]+/.test(part)) {
                return (
                    <Link
                        key={i}
                        href={`/search?q=${encodeURIComponent(part.slice(1))}`}
                        onClick={stop}
                        className="font-semibold text-sky-500 decoration-sky-300 decoration-wavy underline-offset-4 hover:text-blue-600 hover:underline"
                    >
                        {part}
                    </Link>
                );
            }
            if (/^@[^\s@]+/.test(part)) {
                return (
                    <Link
                        key={i}
                        href={`/u/${part.slice(1)}`}
                        onClick={stop}
                        className="font-semibold text-indigo-500 hover:text-indigo-600 hover:underline"
                    >
                        {part}
                    </Link>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    if (!author) return null;

    const replyCount = post.replies.length;

    const actions = [
        {
            key: "reply",
            label: `回复，${replyCount} 条回复`,
            count: replyCount,
            active: false,
            color: "hover:text-sky-500 [&:hover_.bubble]:bg-sky-100",
            icon: ReplyIcon,
            onClick: openDetail,
        },
        {
            key: "boost",
            label: post.boostedByMe ? "取消转发" : "转发",
            count: post.boosts,
            active: post.boostedByMe,
            color: "hover:text-emerald-500 [&:hover_.bubble]:bg-emerald-100",
            icon: BoostIcon,
            onClick: () => toggleBoost(post.id),
        },
        {
            key: "like",
            label: post.likedByMe ? "取消喜欢" : "喜欢",
            count: post.likes,
            active: post.likedByMe,
            color: "hover:text-pink-500 [&:hover_.bubble]:bg-pink-100",
            icon: HeartIcon,
            onClick: () => toggleLike(post.id),
        },
        {
            key: "share",
            label: "分享",
            count: 0,
            active: false,
            color: "hover:text-violet-500 [&:hover_.bubble]:bg-violet-100",
            icon: ShareIcon,
            onClick: openDetail,
        },
    ];

    return (
        <article
            onClick={openDetail}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                }
            }}
            role="link"
            tabIndex={0}
            aria-label={`查看 ${author.displayName} 的帖子详情`}
            className={cn(
                "glass-card group relative cursor-pointer p-5 transition-all duration-200",
                isContext
                    ? "!shadow-none opacity-95 hover:!bg-white/50"
                    : "hover:-translate-y-0.5 hover:shadow-glow",
            )}
        >
            <div className="flex items-start gap-3">
                <Link
                    href={`/u/${author.username}`}
                    aria-label={`${author.displayName} 的主页`}
                    onClick={stop}
                >
                    <Avatar name={author.displayName} src={author.avatarUrl} size={46} />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-2 gap-y-0 flex-wrap">
                        <Link
                            href={`/u/${author.username}`}
                            onClick={stop}
                            className="truncate font-display text-[15px] font-extrabold text-slate-800 hover:text-sky-600"
                        >
                            {author.displayName}
                        </Link>
                        <span className="truncate text-xs text-slate-400">
                            @{author.username}@{author.instance}
                        </span>
                        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                            <RelativeTime iso={post.createdAt} />
                        </span>
                        <button
                            type="button"
                            aria-label="更多操作"
                            onClick={stop}
                            className="ml-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-white/80 hover:text-sky-500 focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex"
                        >
                            <MoreIcon size={16} />
                        </button>
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                        {renderContent(post.content)}
                    </p>

                    <div className="mt-3 flex max-w-sm items-center justify-between gap-2 sm:max-w-md">
                        {actions.map(({ key, label, count, active, color, icon: IconCmp, onClick }) => (
                            <button
                                key={key}
                                type="button"
                                aria-label={label}
                                aria-pressed={active || undefined}
                                disabled={isMine && (key === "boost" || key === "like")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick?.();
                                }}
                                className={cn(
                                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors duration-150",
                                    active
                                        ? key === "like"
                                            ? "text-pink-500"
                                            : "text-emerald-500"
                                        : "text-slate-400",
                                    !active && color,
                                    isMine && (key === "boost" || key === "like")
                                        ? "cursor-not-allowed opacity-40"
                                        : "",
                                )}
                            >
                                <span className="bubble rounded-full p-1.5 transition-colors">
                                    <IconCmp
                                        size={17}
                                        className={cn(active && key === "like" && "fill-pink-500")}
                                    />
                                </span>
                                {count > 0 && formatCount(count)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
