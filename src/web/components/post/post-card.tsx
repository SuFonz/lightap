"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostContent } from "@/web/components/post/post-content";
import { Avatar } from "@/web/components/ui/avatar";
import { HeartIcon, MoreIcon, ReplyIcon } from "@/web/components/ui/icons";
import { Popover } from "@/web/components/ui/popover";
import { RelativeTime } from "@/web/components/ui/relative-time";
import { cn } from "@/web/lib/cn";
import { formatCount } from "@/web/lib/format";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";
import type { Post, PostVariant } from "@/web/types";

const MENU_ITEM_CLASS =
    "flex w-full cursor-pointer items-center rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-white/80 hover:text-brand-deep";

/** 帖子的 uri host 与本站不一致 → 认为是非本站（远程）的帖子 */
function isRemoteUri(uri: string, localHost: string): boolean {
    if (!uri || !localHost) return false;
    try {
        return new URL(uri).host !== localHost;
    } catch {
        return false;
    }
}

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
    const { toggleLike, deletePost } = useTimeline();
    const { session, isAuthenticated } = useSession();
    const { openAuth, showToast } = useUi();
    const router = useRouter();
    const author = getUser(post.authorUsername);
    const detailHref = `/post/${post.id}`;
    const isContext = variant === "context";

    const [menuOpen, setMenuOpen] = useState(false);
    const moreRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const openDetail = useCallback(() => router.push(detailHref), [router, detailHref]);
    const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    // 点击菜单外部时关闭
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (moreRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    if (!author) return null;

    const replyCount = post.repliesCount;
    // 本站 host（仅浏览器端可得；菜单默认关闭，SSR 输出不受影响）
    const localHost = typeof window === "undefined" ? "" : window.location.host;
    // 只有非本站的帖子才显示“原始帖子”
    const isRemote = isRemoteUri(post.uri, localHost);
    // 只有登录了、且这条帖子是自己发的才显示删除（后端还会再校验作者）
    const canDelete = isAuthenticated && !!session && session.username === author.username;

    function handleExpand() {
        setMenuOpen(false);
        openDetail();
    }

    function handleOpenOriginal() {
        setMenuOpen(false);
        if (post.uri) {
            window.open(post.uri, "_blank", "noopener,noreferrer");
        }
    }

    function handleDelete() {
        setMenuOpen(false);
        if (!window.confirm("确定删除这条帖子吗？")) return;
        void deletePost(post).catch(() => showToast("删除失败，请稍后重试"));
    }

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
                            ref={moreRef}
                            aria-label="更多操作"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen((prev) => !prev);
                            }}
                            className={cn(
                                "ml-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-white/80 hover:text-brand-deep focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex",
                                menuOpen && "opacity-100",
                            )}
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
                            {formatCount(replyCount)}
                        </button>

                        <button
                            type="button"
                            aria-label={post.likedByMe ? `取消点赞，${post.likes} 个赞` : `点赞，${post.likes} 个赞`}
                            aria-pressed={post.likedByMe}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                    openAuth("login");
                                    return;
                                }
                                void toggleLike(post).catch(() => {
                                    showToast(post.likedByMe ? "取消点赞失败，请稍后重试" : "点赞失败，请稍后重试");
                                });
                            }}
                            className={cn(
                                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors duration-150 [&:hover_.bubble]:bg-sakura/15",
                                post.likedByMe ? "text-sakura-deep" : "text-slate-400 hover:text-sakura-deep",
                            )}
                        >
                            <span
                                className={cn(
                                    "bubble rounded-full p-1.5 transition-colors",
                                    post.likedByMe && "bg-sakura/15",
                                )}
                            >
                                <HeartIcon size={17} fill={post.likedByMe ? "currentColor" : "none"} />
                            </span>
                            {formatCount(post.likes)}
                        </button>
                    </div>
                </div>
            </div>

            <Popover
                open={menuOpen}
                anchorRef={moreRef}
                width={168}
                align="right"
                className="glass-strong overflow-hidden p-1.5"
            >
                {/* portal 到 body，但 React 事件仍会冒泡到 article，这里阻止掉 */}
                <div ref={menuRef} role="menu" onClick={(e) => e.stopPropagation()} className="flex flex-col">
                    <button type="button" role="menuitem" onClick={handleExpand} className={MENU_ITEM_CLASS}>
                        展开
                    </button>
                    {isRemote && (
                        <button type="button" role="menuitem" onClick={handleOpenOriginal} className={MENU_ITEM_CLASS}>
                            原始帖子
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleDelete}
                            className={cn(MENU_ITEM_CLASS, "text-sakura-deep hover:bg-sakura/10 hover:text-sakura-deep")}
                        >
                            删除
                        </button>
                    )}
                </div>
            </Popover>
        </article>
    );
}
