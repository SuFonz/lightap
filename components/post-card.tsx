"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
// import { BoostIcon, HeartIcon, MoreIcon, ReplyIcon, ShareIcon } from "@/components/icons";
import { MoreIcon, ReplyIcon } from "@/components/icons";
import { RelativeTime } from "@/components/relative-time";
import { usePostStore } from "@/stores/post-store";
import { useUserStore } from "@/stores/user-store";
import { TagPill } from "@/components/tag-pill";
import type { Post } from "@/lib/types/http";
import { cn, formatCount } from "@/lib/client/utils";

export function PostCard({
    post,
    variant = "default",
    bare = false,
}: {
    post: Post;
    variant?: "default" | "context";
    /** 嵌入单一玻璃容器的时间线行，不再各自成卡 */
    bare?: boolean;
}) {
    // const { toggleLike, toggleBoost } = usePostStore();
    const { getUser, currentUser } = useUserStore();
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
                    <TagPill
                        key={i}
                        label={part}
                        href={`/search?q=${encodeURIComponent(part.slice(1))}`}
                        onClick={stop}
                    />
                );
            }
            if (/^@[^\s@]+/.test(part)) {
                return (
                    <Link
                        key={i}
                        href={`/u/${part.slice(1)}`}
                        onClick={stop}
                        className="font-bold text-brand-deep hover:underline"
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
            color: "hover:text-brand-deep [&:hover_.bubble]:bg-brand/15",
            icon: ReplyIcon,
            onClick: openDetail,
        },
        // 功能未实现，暂时注释：
        // {
        //     key: "boost",
        //     label: post.boostedByMe ? "取消转发" : "转发",
        //     count: post.boosts,
        //     active: post.boostedByMe,
        //     color: "hover:text-magic-deep [&:hover_.bubble]:bg-magic/15",
        //     icon: BoostIcon,
        //     onClick: () => toggleBoost(post.id),
        // },
        // {
        //     key: "like",
        //     label: post.likedByMe ? "取消喜欢" : "喜欢",
        //     count: post.likes,
        //     active: post.likedByMe,
        //     color: "hover:text-sakura-deep [&:hover_.bubble]:bg-sakura/20",
        //     icon: HeartIcon,
        //     onClick: () => toggleLike(post.id),
        // },
        // {
        //     key: "share",
        //     label: "分享",
        //     count: 0,
        //     active: false,
        //     color: "hover:text-brand-deep [&:hover_.bubble]:bg-brand/15",
        //     icon: ShareIcon,
        //     onClick: openDetail,
        // },
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
                "group relative cursor-pointer transition-colors duration-150",
                bare
                    ? cn("px-4 py-4 hover:bg-white/45 sm:px-5", isContext && "opacity-90")
                    : cn(
                          "glass-card p-5 transition-all duration-200",
                          isContext
                              ? "!shadow-none opacity-95 hover:!bg-white/50"
                              : "hover:-translate-y-0.5 hover:shadow-glow",
                      ),
            )}
        >
            <div className="flex items-start gap-3">
                <Link
                    href={`/u/${author.username}`}
                    aria-label={`${author.displayName} 的主页`}
                    onClick={stop}
                >
                    <Avatar name={author.displayName} src={author.avatarUrl} size={46} status={author.online} />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-2 gap-y-0 flex-wrap">
                        <Link
                            href={`/u/${author.username}`}
                            onClick={stop}
                            className="truncate font-display text-[15px] font-extrabold text-slate-800 hover:text-brand-deep"
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
                            className="ml-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-white/80 hover:text-brand-deep focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex"
                        >
                            <MoreIcon size={16} />
                        </button>
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
                        {renderContent(post.content)}
                    </p>

                    <div className="mt-2.5 flex max-w-sm items-center justify-between gap-2 sm:max-w-md">
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
                                            ? "text-sakura-deep"
                                            : "text-magic-deep"
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
                                        className={cn(active && key === "like" && "fill-sakura")}
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
