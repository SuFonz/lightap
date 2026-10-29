"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { Modal } from "@/web/components/ui/modal";
import { useInfiniteScroll } from "@/web/hooks/use-infinite-scroll";
import { useI18n } from "@/web/lib/i18n";
import { profileHref } from "@/web/lib/user";
import { useTimeline } from "@/web/stores/timeline";
import type { FollowDirection, FollowUser } from "@/web/types";

interface FollowListModalProps {
    open: boolean;
    onClose: () => void;
    /** 要展示谁的列表 */
    username: string;
    domain?: string | null;
    direction: FollowDirection;
}

/**
 * 关注 / 粉丝列表弹窗。
 *
 * 为什么用弹窗而不是独立页面：这两份列表通常是「顺手看一眼」，
 * 用弹窗能保留资料页的上下文（返回后不丢滚动位置与已加载的帖子），
 * 也不必为它加一条路由。
 */
export function FollowListModal({ open, onClose, username, domain, direction }: FollowListModalProps) {
    const { t } = useI18n();
    const { followLists, followListsMeta, loadFollowList, loadMoreFollowList } = useTimeline();

    /**
     * 记住最后一次真正展示的方向。
     *
     * 为什么需要：父组件关闭弹窗时会把 direction 回退成默认值（"following"），
     * 但 Modal 还要播 150ms 退场动画，内容仍在屏幕上。
     * 若直接用 direction，标题会在退场期间从「粉丝」闪成「正在关注」。
     * 所以这里只在打开时更新，关闭期间沿用旧值。
     */
    const [shownDirection, setShownDirection] = useState<FollowDirection>(direction);
    useEffect(() => {
        if (open) setShownDirection(direction);
    }, [open, direction]);

    // 缓存键与 store 里一致（followListKey 的逻辑）
    const key = `${domain ? `${username}@${domain}` : username}#${shownDirection}`;
    const list: FollowUser[] | undefined = followLists[key];
    const meta = followListsMeta[key];

    // 打开时才加载，避免资料页一进来就发请求
    useEffect(() => {
        if (!open) return;
        void loadFollowList(username, domain, direction);
    }, [open, username, domain, direction, loadFollowList]);

    const loadMore = () => loadMoreFollowList(username, domain, shownDirection);
    const sentinelRef = useInfiniteScroll(loadMore, Boolean(meta?.hasMore) && !meta?.loadingMore);

    const title = shownDirection === "following" ? t("profile.followingList") : t("profile.followersList");
    const emptyText = shownDirection === "following" ? t("profile.noFollowing") : t("profile.noFollowers");

    return (
        <Modal
            open={open}
            onClose={onClose}
            label={title}
            alignClassName="items-center justify-center p-3 sm:p-4"
            panelClassName="surface-raised flex max-h-[80vh] w-full max-w-sm flex-col p-0"
        >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-display text-[15px] font-black text-fg">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="press-sm cursor-pointer rounded-[10px] px-2 py-1 text-[12px] font-bold text-fg-mute transition-colors hover:bg-overlay hover:text-fg"
                >
                    {t("profile.closeList")}
                </button>
            </div>

            {/* 列表 */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {list === undefined ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-fg-mute">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                        <span className="text-[12px]">{t("profile.loadingFollows")}</span>
                    </div>
                ) : list.length === 0 ? (
                    <p className="py-12 text-center text-[12px] text-fg-mute">{emptyText}</p>
                ) : (
                    <ul>
                        {list.map((item) => (
                            <li key={item.actorUrl} className="border-b border-line/60 last:border-0">
                                <Link
                                    href={profileHref(item)}
                                    onClick={onClose}
                                    className="row-quiet flex items-center gap-3 px-4 py-3"
                                >
                                    <Avatar name={item.displayName} src={item.avatarUrl} size={38} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-display text-[13px] font-bold text-fg">
                                            {item.displayName}
                                        </p>
                                        <p className="truncate text-[11px] text-fg-mute">
                                            @{item.username}@{item.domain}
                                        </p>
                                        {item.bio && (
                                            <p className="mt-0.5 line-clamp-1 text-[11px] text-fg-weak">{item.bio}</p>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}

                {/* 无限滚动哨兵 */}
                <div ref={sentinelRef} aria-hidden="true" />
                {meta?.loadingMore && (
                    <div className="flex items-center justify-center gap-2 py-4 text-fg-mute">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                        <span className="text-[11px]">{t("common.loading")}</span>
                    </div>
                )}
            </div>
        </Modal>
    );
}
