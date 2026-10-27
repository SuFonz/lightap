"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ComposerField } from "@/web/components/composer/composer-field";
import { PostCard } from "@/web/components/post/post-card";
import { ImageIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { useInfiniteScroll } from "@/web/hooks/use-infinite-scroll";
import { useNewItems } from "@/web/hooks/use-new-items";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import type { FeedTab } from "@/web/types";

export default function HomePage() {
 const { isAuthenticated } = useSession();
 const { t } = useI18n();
 const { posts, liveCount, loading, hasMore, loadingMore, loadFeed, loadMore, compose } = useTimeline();
 const [tab, setTab] = useState<FeedTab>("all");
 // 只有新插入的帖子播入场动画（翻页的历史帖不动，避免滚动闪动）
 const isNew = useNewItems(posts.map((post) => post.id));

 // 访客只能看「全部 / 本地」；未登录时把「关注」回退到「全部」
 const feedTab: FeedTab = !isAuthenticated && tab ==="following" ?"all" : tab;

 const tabs: { key: FeedTab; label: string }[] = [
 { key:"all", label: t("home.tab.all") },
 { key:"local", label: t("home.tab.local") },
 ...(isAuthenticated ? [{ key:"following" as FeedTab, label: t("home.tab.following") }] : []),
 ];

 useEffect(() => {
 void loadFeed(feedTab);
 }, [feedTab, loadFeed]);

 const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore);

 const handlePost = useCallback(
 async (content: string) => {
 await compose(content);
 },
 [compose],
 );

 return (
 <div className="flex flex-col">
 {/* ── 顶部标签栏：吸顶，直接贴在页面底色上，不套卡片 ── */}
 <header className="sticky-head -mx-1 flex items-center gap-1 px-1 pb-1.5 pt-1.5">
 {tabs.map(({ key, label }) => (
 <button
 key={key}
 type="button"
 role="tab"
 aria-selected={feedTab === key}
 onClick={() => setTab(key)}
 className={cn("press-sm relative cursor-pointer rounded-full px-3.5 py-1.5 font-display text-[13px] font-bold transition-colors duration-150",
 feedTab === key ?"text-brand-ink" :"text-fg-mute hover:bg-overlay hover:text-fg-weak",
 )}
 >
 {label}
 {feedTab === key && (
 <span
 className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-brand"
 style={{ animation:"swap-in 0.2s var(--ease-out)" }}
 />
 )}
 </button>
 ))}
 </header>

 {/* ── 发帖入口：需要独立层级的少数元素之一 ── */}
 {isAuthenticated && (
 <div className="mt-2">
 <ComposerField onSubmit={handlePost} />
 </div>
 )}

 {/* ── 时间线：直接流入页面，没有外层卡片 ── */}
 <section key={feedTab} className="swap-in divided mt-2" aria-label={t("home.timeline")}>
 {posts.map((post, index) => (
 <Fragment key={post.id}>
 {liveCount > 0 && index === liveCount && (
 <div className="flex items-center gap-3 py-2 text-[11px] font-semibold text-fg-mute">
 <span className="h-px flex-1 bg-line" />
 {t("home.realtimeDivider")}
 <span className="h-px flex-1 bg-line" />
 </div>
 )}
 {/* 只有本次新插入的帖子才播入场动画：翻页加载的历史帖保持静止，
     否则滚动时整列会闪动 */}
 <div className={cn(isNew(post.id) && "rise-in")}>
 <PostCard post={post} bare />
 </div>
 </Fragment>
 ))}

 {posts.length === 0 && (
 <div className="flex flex-col items-center gap-2 py-20 text-center">
 <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-overlay text-fg-mute">
 <ImageIcon size={20} />
 </span>
 <p className="font-display text-[14px] font-bold text-fg">
 {loading ? t("common.loading") : t("home.emptyTitle")}
 </p>
 <p className="text-[12px] text-fg-mute">
 {t(isAuthenticated ?"home.emptyMine" :"home.emptyGuest")}
 </p>
 </div>
 )}

 {loadingMore && (
 <div className="flex items-center justify-center gap-2 py-6 text-fg-mute">
 <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
 <span className="text-[12px] font-medium">{t("common.loading")}</span>
 </div>
 )}
 </section>

 {/* 无限滚动哨兵 */}
 <div ref={sentinelRef} aria-hidden="true" />
 </div>
 );
}
