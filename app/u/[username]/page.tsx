"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { EditProfileModal } from "@/components/edit-profile-modal";
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
import { useStore } from "@/components/store";
import { formatCount } from "@/lib/utils";

export default function ProfilePage() {
    const params = useParams<{ username: string }>();
    const username = typeof params?.username === "string" ? params.username : "";
    const { getUser, posts, currentUser } = useStore();

    const user = getUser(username);
    const isMe = user?.username === currentUser.username;
    const userPosts = posts
        .filter((p) => p.authorUsername === username)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (!user) {
        return (
            <div className="glass-card mx-auto mt-10 max-w-md px-6 py-16 text-center">
                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-400">
                    <UserIcon size={28} />
                </span>
                <h1 className="font-display text-lg font-black text-slate-800">用户不存在</h1>
                <p className="mt-1 text-sm text-slate-400">
                    没有找到 @{username || "…"}，可能去别的服务器冲浪了～
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                    <HomeIcon size={15} /> 回到首页
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <section className="glass-card overflow-hidden" aria-label={`${user.displayName} 的资料`}>
                <div className="relative h-36 bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 sm:h-44">
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
                    <div className="-mt-12 mb-3 flex items-end justify-between sm:-mt-14">
                        <Avatar name={user.displayName} src={user.avatarUrl} size={96} ring />
                        <div className="mb-1 flex items-center gap-2">
                            {isMe ? (
                                <EditProfileTrigger />
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        aria-label="订阅通知（占位）"
                                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-sky-200 bg-white/70 text-sky-500 transition hover:border-sky-300 hover:bg-sky-50 active:scale-95"
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
                            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-100 to-blue-100 px-2 py-0.5 text-[11px] font-extrabold text-blue-600"
                            title="已验证账户"
                        >
                            <CheckIcon size={11} strokeWidth={3} /> 已验证
                        </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
                        @{user.username}@{user.instance}
                    </p>

                    {user.bio && (
                        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-600">
                            {user.bio}
                        </p>
                    )}

                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        {(
                            [
                                ["帖子", user.postsCount],
                                ["关注", user.followingCount],
                                ["粉丝", user.followers],
                            ] as const
                        ).map(([label, count]) => (
                            <div key={label} className="flex items-baseline gap-1.5">
                                <dt className="font-display text-lg font-black tabular-nums text-blue-600">
                                    {formatCount(count)}
                                </dt>
                                <dd className="text-xs font-semibold text-slate-400">{label}</dd>
                            </div>
                        ))}
                        <span className="ml-auto inline-flex items-center gap-1 self-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
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
                <div className="rise-in flex flex-col gap-4">
                    {userPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
        >
            <EditIcon size={15} /> 编辑资料
        </button>
    );
}
