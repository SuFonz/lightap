"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PostCard } from "@/web/components/post/post-card";
import { Avatar } from "@/web/components/ui/avatar";
import { EditIcon, GlobeIcon, HomeIcon, UserIcon } from "@/web/components/ui/icons";
import { FollowButton } from "@/web/components/user/follow-button";
import { formatCount } from "@/web/lib/format";
import { postsKey } from "@/web/lib/user";
import { useI18n } from "@/web/lib/i18n";
import { useInfiniteScroll } from "@/web/hooks/use-infinite-scroll";
import { useDirectory } from "@/web/stores/directory";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";

function ProfilePageInner() {
    const params = useParams<{ username: string }>();
    const searchParams = useSearchParams();
    const username = typeof params?.username === "string" ? params.username : "";
    const domain = searchParams.get("domain");
    const { getUser, currentUser, loadProfile, isProfileMissing } = useDirectory();
    const { userPosts, userPostsMeta, loadUserPosts, loadMoreUserPosts } = useTimeline();
    const { openEditProfile } = useUi();
    const { t } = useI18n();

    const user = getUser(username, domain);
    const missing = isProfileMissing(username, domain);
    // 未加载过为 undefined，加载完成后是数组
    // 缓存键带 domain：远程 admin 与本地 admin 是两个人，帖子列表不能互相顶掉
    const list = userPosts[postsKey(username, domain)];
    const meta = userPostsMeta[postsKey(username, domain)];

    useEffect(() => {
        void loadProfile(username, domain);
        void loadUserPosts(username, domain);
    }, [username, domain, loadProfile, loadUserPosts]);

    const loadMorePosts = useCallback(
        () => loadMoreUserPosts(username, domain),
        [loadMoreUserPosts, username, domain],
    );
    const sentinelRef = useInfiniteScroll(loadMorePosts, Boolean(meta?.hasMore) && !meta?.loadingMore);

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
                        {(
                            [
                                // 用后端统计的总数，而不是当前已加载的列表长度
                                [t("profile.posts"), user.postsCount],
                                [t("profile.following"), user.followingCount],
                                [t("profile.followers"), user.followersCount],
                            ] as const
                        ).map(([label, count]) => (
                            <div key={label} className="flex items-baseline gap-1">
                                <dt className="font-display text-[14px] font-extrabold tabular-nums text-fg">
                                    {formatCount(count)}
                                </dt>
                                <dd className="text-[11px] font-medium text-fg-mute">{label}</dd>
                            </div>
                        ))}
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-[10px] font-semibold text-fg-mute">
                            <GlobeIcon size={9} /> {t("profile.public")}
                        </span>
                    </dl>
                </div>
            </div>

            {/* 帖子列表标题 */}
            <div className="mt-5 flex items-baseline gap-1.5 border-b border-line pb-2">
                <h2 className="font-display text-[12px] font-extrabold text-fg">
                    {isMe ? t("profile.myPosts") : t("profile.postsOf", { name: user.displayName })}
                </h2>
                <span className="text-[11px] font-semibold tabular-nums text-fg-mute">{user.postsCount}</span>
            </div>

            {list === undefined ? (
                <div className="flex items-center justify-center gap-2 py-16 text-fg-mute">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-[12px] font-medium">{t("profile.loadingPosts")}</span>
                </div>
            ) : list.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-16 text-center">
                    <p className="font-display text-[13px] font-bold text-fg">{t("profile.noPosts")}</p>
                    <p className="text-[12px] text-fg-mute">{t("profile.noPostsHint")}</p>
                </div>
            ) : (
                <div className="divided" aria-label={t("profile.postList")}>
                    {list.map((post) => (
                        <PostCard key={post.id} post={post} bare />
                    ))}
                </div>
            )}

            {/* 无限滚动哨兵 */}
            <div ref={sentinelRef} aria-hidden="true" />
            {meta?.loadingMore && (
                <div className="flex items-center justify-center gap-2 py-6 text-fg-mute">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span className="text-[12px] font-medium">{t("common.loading")}</span>
                </div>
            )}
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
