"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { PostContent } from "@/web/components/post/post-content";
import { Avatar } from "@/web/components/ui/avatar";
import { MoreIcon, ReplyIcon } from "@/web/components/ui/icons";
import { RelativeTime } from "@/web/components/ui/relative-time";
import { cn } from "@/web/lib/cn";
import { formatCount } from "@/web/lib/format";
import { useDirectory } from "@/web/stores/directory-store";
import type { Post, PostVariant } from "@/web/types";

export function PostCard({
    post,
    variant = "default",
    bare = false,
}: {
    post: Post;
    variant?: PostVariant;
    /** 嵌入单一玻璃容器的时间线行，不再各自成卡 */
    bare?: boolean;
}) {
    const { getUser } = useDirectory();
    const router = useRouter();
    const author = getUser(post.authorUsername);
    const detailHref = `/post/${post.id}`;
    const isContext = variant === "context";

    const openDetail = useCallback(() => router.push(detailHref), [router, detailHref]);
    const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    if (!author) return null;

    const replyCount = post.replies.length;

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
                    <Avatar name={author.displayName} src={author.avatarUrl} size={46} />
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
                        <PostContent content={post.content} onTagClick={stop} />
                    </p>

                    <div className="mt-2.5 flex max-w-sm items-center gap-2 sm:max-w-md">
                        <button
                            type="button"
                            aria-label={`回复，${replyCount} 条回复`}
                            onClick={(e) => {
                                e.stopPropagation();
                                openDetail();
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-400 transition-colors duration-150 hover:text-brand-deep [&:hover_.bubble]:bg-brand/15"
                        >
                            <span className="bubble rounded-full p-1.5 transition-colors">
                                <ReplyIcon size={17} />
                            </span>
                            {replyCount > 0 && formatCount(replyCount)}
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}
