"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import {
    BellIcon,
    CheckIcon,
    EditIcon,
    GlobeIcon,
    HomeIcon,
    SparklesIcon,
    UserIcon,
} from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { useShell } from "@/components/shell-context";
import { usePostStore } from "@/stores/post-store";
import { useUserStore } from "@/stores/user-store";
import { pillTones, TagPill } from "@/components/tag-pill";
import { formatCount } from "@/lib/client/utils";

export default function ProfilePage() {
    const params = useParams<{ username: string }>();
    const username = typeof params?.username === "string" ? params.username : "";
    const { getUser, currentUser } = useUserStore();
    const { posts } = usePostStore();

    const user = getUser(username);
    const isMe = user?.username === currentUser.username;
    const userPosts = posts
        .filter((p) => p.authorUsername === username)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (!user) {
        return (
            <div className="mx-auto mt-10 max-w-md px-6 py-16 text-center">
                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <UserIcon size={28} />
                </span>
                <h1 className="font-display text-lg font-black text-slate-800">用户不存在</h1>
                <p className="mt-1 text-sm text-slate-400">
                    没有找到 @{username || "…"}，可能去别的服务器冲浪了～
                </p>
                <Link
                    href="/"
                    className="btn-solid mt-6 inline-flex px-5 py-2.5 font-display text-sm font-bold"
                >
                    <HomeIcon size={15} /> 回到首页
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card overflow-hidden" aria-label={`${user.displayName} 的资料`}>
                {/* 天空横幅：蓝 → 淡紫 */}
                <div className="relative h-32 bg-gradient-to-r from-[#9ed2ff] via-brand to-[#b3a8ff] sm:h-40">
                    <div
                        className="absolute inset-0 opacity-60"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle at 20% 120%, rgba(255,255,255,.55), transparent 45%), radial-gradient(circle at 80% -20%, rgba(255,255,255,.4), transparent 40%)",
                        }}
                        aria-hidden="true"
                    />
                    <SparklesIcon size={22} className="absolute right-6 top-5 text-white/70" />
                </div>

                <div className="px-5 pb-5">
                    <div className="-mt-11 mb-3 flex items-end justify-between sm:-mt-13">
                        <Avatar name={user.displayName} src={user.avatarUrl} size={92} ring status={user.online} />
                        <div className="mb-1 flex items-center gap-2">
                            {isMe ? (
                                <EditProfileTrigger />
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        aria-label="订阅通知（占位）"
                                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-white/80 bg-white/60 text-brand-deep transition hover:bg-white/90 active:scale-90"
                                    >
                                        <BellIcon size={17} />
                                    </button>
                                    <FollowButton username={user.username} />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h1 className="font-display text-xl font-black text-slate-800">{user.displayName}</h1>
                        <span
                            className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-extrabold text-brand-ink ring-1 ring-brand/20"
                            title="已验证账户"
                        >
                            <CheckIcon size={11} strokeWidth={3} /> 已验证
                        </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
                        @{user.username}@{user.instance}
                    </p>

                    {/* 二次元小徽章：紫粉蓝胶囊 */}
                    {user.badges && user.badges.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {user.badges.map((badge, i) => (
                                <TagPill
                                    key={badge}
                                    label={badge}
                                    tone={pillTones[(i + 1) % pillTones.length]}
                                />
                            ))}
                        </div>
                    )}

                    {user.bio && (
                        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-600">
                            {user.bio}
                        </p>
                    )}

                    <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        {(
                            [
                                ["帖子", user.postsCount],
                                ["关注", user.followingCount],
                                ["粉丝", user.followers],
                            ] as const
                        ).map(([label, count]) => (
                            <div key={label} className="flex items-baseline gap-1.5">
                                <dt className="font-display text-lg font-black tabular-nums text-brand-ink">
                                    {formatCount(count)}
                                </dt>
                                <dd className="text-xs font-semibold text-slate-400">{label}</dd>
                            </div>
                        ))}
                        <span className="ml-auto inline-flex items-center gap-1 self-center rounded-full bg-magic/12 px-2.5 py-0.5 text-[11px] font-bold text-magic-deep">
                            <GlobeIcon size={11} /> 联邦宇宙公开账户
                        </span>
                    </dl>
                </div>
            </section>

            <h2 className="glass-card px-5 py-3 font-display text-sm font-extrabold text-slate-700">
                {isMe ? "我的帖子" : `${user.displayName} 的帖子`} · {userPosts.length}
            </h2>

            {userPosts.length === 0 ? (
                <div className="glass-card px-6 py-14 text-center">
                    <p className="font-display font-extrabold text-slate-700">还没有发过帖子</p>
                    <p className="mt-1 text-sm text-slate-400">第一帖就从「大家好」开始吧～</p>
                </div>
            ) : (
                <section className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="帖子列表">
                    {userPosts.map((post) => (
                        <PostCard key={post.id} post={post} bare />
                    ))}
                </section>
            )}
        </div>
    );
}

function EditProfileTrigger() {
    const { openEditProfile } = useShell();
    return (
        <button
            type="button"
            onClick={openEditProfile}
            className="btn-solid px-4 py-2 font-display text-sm font-bold"
        >
            <EditIcon size={15} /> 编辑资料
        </button>
    );
}
