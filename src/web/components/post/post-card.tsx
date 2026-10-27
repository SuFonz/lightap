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
import { useI18n } from "@/web/lib/i18n";
import { profileHref } from "@/web/lib/user";
import { usePulseOnChange } from "@/web/hooks/use-pulse-on-change";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";
import type { Post, PostVariant } from "@/web/types";

const MENU_ITEM_CLASS =
    "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold text-fg-weak transition-colors hover:bg-overlay hover:text-brand-deep";

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
    const { t } = useI18n();
    const { toggleLike, deletePost } = useTimeline();
    const { session, isAuthenticated } = useSession();
    const { openAuth, showToast } = useUi();
    const router = useRouter();
    const author = getUser(post.authorUsername, post.domain);
    const detailHref = `/post/${post.id}`;
    const isContext = variant === "context";

    const [menuOpen, setMenuOpen] = useState(false);
    const moreRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // 按下时的坐标：用来区分「点击」与「按住拖选文字」
    const pressRef = useRef<{ x: number; y: number } | null>(null);
    // 点赞从「未赞」变「已赞」时自增，驱动心跳动画重播
    const likePulseKey = usePulseOnChange(post.likedByMe);

    const openDetail = useCallback(() => router.push(detailHref), [router, detailHref]);
    const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    /**
     * 只有「点击」才进帖子详情。
     *
     * 与 Twitter 一致：用户在正文里拖选文字（想复制）时不应该被判成点击跳转。
     * 两种信号任一成立就跳过跳转：
     * 1. 指针从按下到松开移动超过阈值（拖选 / 滑动）
     * 2. 当前存在非空的文本选区（双击选词、三击选段等没有位移的情况）
     */
    const handleCardClick = useCallback(
        (e: React.MouseEvent) => {
            const press = pressRef.current;
            pressRef.current = null;

            // 拖拽过就算拖选，不跳转
            if (press) {
                const dx = e.clientX - press.x;
                const dy = e.clientY - press.y;
                if (dx * dx + dy * dy > 16) return;
            }

            // 有选区也不跳转（双击选词时指针几乎没动）
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;

            openDetail();
        },
        [openDetail],
    );

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
        if (!window.confirm(t("post.confirmDelete"))) return;
        void deletePost(post).catch(() => showToast(t("common.deleteFailed")));
    }

    return (
        <article
            onPointerDown={(e) => {
                // 只记左键 / 触摸，右键和菜单键不参与「点击」判定
                pressRef.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
            }}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                }
            }}
            role="link"
            tabIndex={0}
            aria-label={t("post.viewDetail", { name: author.displayName })}
            className={cn(
                "group relative cursor-pointer transition-colors duration-150",
                bare
                    ? // 流内的一行：hover 只把底色提亮一点点
                      cn("row-quiet px-3 py-3.5 sm:px-4", isContext && "opacity-85")
                    : cn(
                          "surface p-4 transition-colors duration-150",
                          isContext && "shadow-none opacity-90",
                      ),
            )}
        >
            <div className="flex items-start gap-3">
                <Link
                    href={profileHref(author)}
                    aria-label={t("post.authorHome", { name: author.displayName })}
                    onClick={stop}
                >
                    <Avatar name={author.displayName} src={author.avatarUrl} size={46} interactive />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-2 gap-y-0 flex-wrap">
                        <Link
                            href={profileHref(author)}
                            onClick={stop}
                            className="truncate font-display text-[15px] font-extrabold text-fg hover:text-brand-deep"
                        >
                            {author.displayName}
                        </Link>
                        <span className="truncate text-xs text-fg-mute">
                            @{author.username}@{author.instance}
                        </span>
                        <span className="ml-auto whitespace-nowrap text-xs text-fg-mute">
                            <RelativeTime iso={post.createdAt} />
                        </span>
                        <button
                            type="button"
                            ref={moreRef}
                            aria-label={t("common.more")}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen((prev) => !prev);
                            }}
                            className={cn(
                                "ml-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-fg-mute opacity-0 transition-colors hover:bg-overlay hover:text-brand-deep focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex",
                                menuOpen && "opacity-100",
                            )}
                        >
                            <MoreIcon size={16} />
                        </button>
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">
                        <PostContent content={post.content} onTagClick={stop} />
                    </p>

                    <div className="mt-2.5 flex max-w-sm items-center gap-1 sm:max-w-md">
                        <button
                            type="button"
                            aria-label={t("post.replyCount", { count: replyCount })}
                            onClick={(e) => {
                                e.stopPropagation();
                                openDetail();
                            }}
                            className="press-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-fg-mute transition-colors duration-150 hover:text-brand-deep [&:hover_.bubble]:bg-brand/15"
                        >
                            <span className="bubble rounded-full p-1.5 transition-colors">
                                <ReplyIcon size={17} />
                            </span>
                            {formatCount(replyCount)}
                        </button>

                        <button
                            type="button"
                            aria-label={t(post.likedByMe ? "post.unlike" : "post.like", { count: post.likes })}
                            aria-pressed={post.likedByMe}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                    openAuth("login");
                                    return;
                                }
                                void toggleLike(post).catch(() => {
                                    showToast(t(post.likedByMe ? "common.unlikeFailed" : "common.likeFailed"));
                                });
                            }}
                            className={cn(
                                "press-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors duration-150 [&:hover_.bubble]:bg-sakura/15",
                                post.likedByMe ? "text-sakura-deep" : "text-fg-mute hover:text-sakura-deep",
                            )}
                        >
                            <span
                                className={cn(
                                    "bubble rounded-full p-1.5 transition-colors",
                                    post.likedByMe && "bg-sakura/15",
                                )}
                            >
                                {/* 心跳只在「点上去」时播一次，取消点赞不动 */}
                                <span
                                    key={likePulseKey}
                                    className={cn("inline-flex", likePulseKey > 0 && "heart-pop")}
                                >
                                    <HeartIcon size={17} fill={post.likedByMe ? "currentColor" : "none"} />
                                </span>
                            </span>
                            <span key={likePulseKey} className={cn(likePulseKey > 0 && "count-bump")}>
                                {formatCount(post.likes)}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <Popover
                open={menuOpen}
                anchorRef={moreRef}
                width={168}
                align="right"
                className="surface-raised overflow-hidden p-1.5"
            >
                {/* portal 到 body，但 React 事件仍会冒泡到 article，这里阻止掉 */}
                <div ref={menuRef} role="menu" onClick={(e) => e.stopPropagation()} className="flex flex-col">
                    <button type="button" role="menuitem" onClick={handleExpand} className={MENU_ITEM_CLASS}>
                        {t("post.expand")}
                    </button>
                    {isRemote && (
                        <button type="button" role="menuitem" onClick={handleOpenOriginal} className={MENU_ITEM_CLASS}>
                            {t("post.original")}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleDelete}
                            className={cn(MENU_ITEM_CLASS, "text-sakura-deep hover:bg-sakura/10 hover:text-sakura-deep")}
                        >
                            {t("post.delete")}
                        </button>
                    )}
                </div>
            </Popover>
        </article>
    );
}
