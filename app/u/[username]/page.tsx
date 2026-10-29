"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PostCard } from "@/web/components/post/post-card";
import { Avatar } from "@/web/components/ui/avatar";
import { EditIcon, GlobeIcon, HomeIcon, UserIcon } from "@/web/components/ui/icons";
import { FollowButton } from "@/web/components/user/follow-button";
import { FollowListModal } from "@/web/components/user/follow-list-modal";
import { formatCount } from "@/web/lib/format";
import { cn } from "@/web/lib/cn";
import { postsKey } from "@/web/lib/user";
import { useI18n } from "@/web/lib/i18n";
import { useInfiniteScroll } from "@/web/hooks/use-infinite-scroll";
import { useDirectory } from "@/web/stores/directory";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";
import type { FollowDirection } from "@/web/types";

/** 资料页的两个标签页 */
type ProfileTab = "posts" | "replies";

function ProfilePageInner() {
    const params = useParams<{ username: string }>();
    const searchParams = useSearchParams();
    const username = typeof params?.username === "string" ? params.username : "";
    const domain = searchParams.get("domain");
    const { getUser, currentUser, loadProfile, isProfileMissing } = useDirectory();
    const {
        userPosts,
        userPostsMeta,
        loadUserPosts,
        loadMoreUserPosts,
        userReplies,
        userRepliesMeta,
        loadUserReplies,
        loadMoreUserReplies,
    } = useTimeline();
    const { openEditProfile } = useUi();
    const { t } = useI18n();

    // 当前选中的标签页
    const [tab, setTab] = useState<ProfileTab>("posts");
    // 关注 / 粉丝弹窗：null 表示未打开
    const [followModal, setFollowModal] = useState<FollowDirection | null>(null);

    const user = getUser(username, domain);
    const missing = isProfileMissing(username, domain);

    // 帖子与回复各自独立缓存（键带 kind），翻一个不影响另一个
    const postsList = userPosts[postsKey(username, domain, "posts")];
    const postsMeta = userPostsMeta[postsKey(username, domain, "posts")];
    const repliesList = userReplies[postsKey(username, domain, "replies")];
    const repliesMeta = userRepliesMeta[postsKey(username, domain, "replies")];

    useEffect(() => {
        void loadProfile(username, domain);
        void loadUserPosts(username, domain);
    }, [username, domain, loadProfile, loadUserPosts]);

    // 切到「回复」时才加载，避免资料页一进来就发两个请求
    useEffect(() => {
        if (tab !== "replies") return;
        void loadUserReplies(username, domain);
    }, [tab, username, domain, loadUserReplies]);

    // 切换用户时回到「帖子」标签页，避免带着上一个人的 tab 状态
    useEffect(() => {
        setTab("posts");
    }, [username, domain]);

    const loadMorePosts = useCallback(
        () => loadMoreUserPosts(username, domain),
        [loadMoreUserPosts, username, domain],
    );
    const loadMoreReplies = useCallback(
        () => loadMoreUserReplies(username, domain),
        [loadMoreUserReplies, username, domain],
    );

    const showReplies = tab === "replies";
    const activeList = showReplies ? repliesList : postsList;
    const activeMeta = showReplies ? repliesMeta : postsMeta;

    const sentinelRef = useInfiniteScroll(
        showReplies ? loadMoreReplies : loadMorePosts,
        Boolean(activeMeta?.hasMore) && !activeMeta?.loadingMore,
    );

    if (!user) {
        if (!missing) return <ProfileSkeleton />;

        return (
            <div className="mx-auto mt-10 max-w-md px-6 py-16 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-overlay text-fg-mute">
                    <UserIcon size={24} />
                </span>
                <h1 className="font-display text-[15px] font-extrabold text-fg">{t("profile.notFound")}</h1>
                <p className="mt-1 text-[13px] text-fg-mute">
                    {t("profile.notFoundHint", { username: username || "…" })}
                </p>
                <Link href="/" className="btn-solid mt-6 inline-flex px-4 py-2 font-display text-[13px] font-bold">
                    <HomeIcon size={14} /> {t("post.backHome")}
                </Link>
            </div>
        );
    }

    // 同名不代表是自己：远程 admin 和本地 admin 是两个人，必须连实例一起比
    const isMe = user.username === currentUser.username && user.instance === currentUser.instance;

    return (
        <div className="flex flex-col">
            <div aria-label={t("profile.aria", { name: user.displayName })}>
                {/* 横幅：一条克制的色带，不做大块渐变 */}
                <div
                    className="relative h-24 rounded-xl sm:h-28"
                    style={{
                        background: "linear-gradient(100deg, hsl(var(--accent-hue) 85% 88%) 0%, hsl(var(--magic-hue) 75% 90%) 100%)",
                    }}
                    aria-hidden="true"
                />

                <div className="px-1">
                    <div className="-mt-10 mb-2 flex items-end justify-between">
                        <Avatar name={user.displayName} src={user.avatarUrl} size={76} ring />
                        <div className="mb-1 flex items-center gap-2">
                            {isMe ? (
                                <button
                                    type="button"
                                    onClick={openEditProfile}
                                    className="btn-solid px-3.5 py-1.5 font-display text-[12px] font-bold"
                                >
                                    <EditIcon size={13} /> {t("profile.edit")}
                                </button>
                            ) : (
                                <FollowButton user={user} />
                            )}
                        </div>
                    </div>

                    <h1 className="font-display text-[17px] font-extrabold text-fg">{user.displayName}</h1>
                    <p className="mt-0.5 text-[12px] text-fg-mute">
                        @{user.username}@{user.instance}
                    </p>

                    {user.bio && (
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-weak">{user.bio}</p>
                    )}

                    <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                        {/* 帖子数：纯展示（下方就是帖子列表，不需要再点） */}
                        <div className="flex items-baseline gap-1">
                            <dt className="font-display text-[14px] font-extrabold tabular-nums text-fg">
                                {formatCount(user.postsCount)}
                            </dt>
                            <dd className="text-[11px] font-medium text-fg-mute">{t("profile.posts")}</dd>
                        </div>

                        {/* 关注 / 粉丝：可点击，点开弹窗看具体列表 */}
                        {(
                            [
                                ["following", t("profile.following"), user.followingCount, t("profile.showFollowing")],
                                ["followers", t("profile.followers"), user.followersCount, t("profile.showFollowers")],
                            ] as const
                        ).map(([direction, label, count, aria]) => (
                            <button
                                key={direction}
                                type="button"
                                onClick={() => setFollowModal(direction)}
                                aria-label={aria}
                                className="press-sm group flex cursor-pointer items-baseline gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-overlay"
                            >
                                <dt className="font-display text-[14px] font-extrabold tabular-nums text-fg transition-colors group-hover:text-brand-ink">
                                    {formatCount(count)}
                                </dt>
                                <dd className="text-[11px] font-medium text-fg-mute transition-colors group-hover:text-brand-ink">
                                    {label}
                                </dd>
                            </button>
                        ))}

                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-[10px] font-semibold text-fg-mute">
                            <GlobeIcon size={9} /> {t("profile.public")}
                        </span>
                    </dl>
                </div>
            </div>

            {/* 标签页：帖子 / 回复 */}
            <div className="mt-5 flex items-center gap-1 border-b border-line" role="tablist">
                {(
                    [
                        ["posts", t("profile.tabPosts")],
                        ["replies", t("profile.tabReplies")],
                    ] as const
                ).map(([key, label]) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(key)}
                            className={cn(
                                "press-sm relative cursor-pointer rounded-t-md px-3 py-2 font-display text-[13px] font-bold transition-colors",
                                active ? "text-fg" : "text-fg-mute hover:text-fg-weak",
                            )}
                        >
                            {label}
                            {/* 激活指示条：与时间线的 tab 风格保持一致 */}
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand transition-opacity",
                                    active ? "opacity-100" : "opacity-0",
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            {activeList === undefined ? (
                <div className="flex items-center justify-center gap-2 py-16 text-fg-mute">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-[12px] font-medium">
                        {showReplies ? t("profile.loadingReplies") : t("profile.loadingPosts")}
                    </span>
                </div>
            ) : activeList.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-16 text-center">
                    <p className="font-display text-[13px] font-bold text-fg">
                        {showReplies ? t("profile.noReplies") : t("profile.noPosts")}
                    </p>
                    <p className="text-[12px] text-fg-mute">
                        {showReplies ? t("profile.noRepliesHint") : t("profile.noPostsHint")}
                    </p>
                </div>
            ) : (
                <div
                    className="divided"
                    aria-label={showReplies ? t("profile.replyList") : t("profile.postList")}
                >
                    {activeList.map((post) => (
                        <PostCard key={post.id} post={post} bare />
                    ))}
                </div>
            )}

            {/* 无限滚动哨兵 */}
            <div ref={sentinelRef} aria-hidden="true" />
            {activeMeta?.loadingMore && (
                <div className="flex items-center justify-center gap-2 py-6 text-fg-mute">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-[12px] font-medium">{t("common.loading")}</span>
                </div>
            )}

            {/* 关注 / 粉丝列表弹窗 */}
            <FollowListModal
                open={followModal !== null}
                onClose={() => setFollowModal(null)}
                username={username}
                domain={domain}
                direction={followModal ?? "following"}
            />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<ProfileSkeleton />}>
            <ProfilePageInner />
        </Suspense>
    );
}

function ProfileSkeleton() {
    const { t } = useI18n();

    return (
        <div className="flex flex-col" aria-busy="true" aria-label={t("profile.loadingProfile")}>
            <div className="h-24 animate-pulse rounded-xl bg-overlay-weak sm:h-28" />
            <div className="px-1">
                <div className="-mt-10 mb-2">
                    <div className="h-[76px] w-[76px] animate-pulse rounded-full bg-overlay ring-4 ring-line" />
                </div>
                <div className="h-4 w-28 animate-pulse rounded bg-overlay" />
                <div className="mt-2 h-3 w-40 animate-pulse rounded bg-overlay-weak" />
                <div className="mt-3 flex gap-5">
                    <div className="h-3.5 w-10 animate-pulse rounded bg-overlay-weak" />
                    <div className="h-3.5 w-10 animate-pulse rounded bg-overlay-weak" />
                    <div className="h-3.5 w-10 animate-pulse rounded bg-overlay-weak" />
                </div>
            </div>
            {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 px-1 py-4">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-overlay-weak" />
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 w-24 animate-pulse rounded bg-overlay-weak" />
                        <div className="h-3 w-full max-w-xs animate-pulse rounded bg-overlay-weak" />
                    </div>
                </div>
            ))}
        </div>
    );
}
