"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Avatar } from "@/components/avatar";
import {
    BellIcon,
    EditIcon,
    FeatherIcon,
    GlobeIcon,
    HomeIcon,
    SearchIcon,
    UserIcon,
    UsersIcon,
} from "@/components/icons";
import { useShell } from "@/components/shell-context";
import { useStore } from "@/components/store";
import { cn, formatCount } from "@/lib/utils";

interface NavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
    badge?: number;
}

export function SidebarContent({
    onNavigate,
    flat = false,
}: {
    onNavigate?: () => void;
    flat?: boolean;
}) {
    const pathname = usePathname();
    const { currentUser, unreadCount } = useStore();
    const { openComposer, openEditProfile } = useShell();

    const navItems: NavItem[] = [
        { href: "/", label: "首页", icon: HomeIcon },
        { href: "/search", label: "搜索", icon: SearchIcon },
        { href: "/notifications", label: "通知", icon: BellIcon, badge: unreadCount },
        { href: "/users", label: "用户浏览", icon: UsersIcon },
        { href: `/u/${currentUser.username}`, label: "我的资料", icon: UserIcon },
    ];

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <div className="flex flex-col gap-4">
            <section className={cn(!flat && "glass-card p-4")} aria-label="个人资料">
                <div className="flex items-center gap-3">
                    <span className="relative">
                        <Avatar
                            name={currentUser.displayName}
                            src={currentUser.avatarUrl}
                            size={52}
                            ring
                        />
                        <span
                            className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400"
                            aria-hidden="true"
                        />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-display text-[15px] font-extrabold text-slate-800">
                            {currentUser.displayName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                            @{currentUser.username}@{currentUser.instance}
                        </p>
                    </div>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                    {[
                        ["帖子", currentUser.postsCount],
                        ["关注", currentUser.followingCount],
                        ["粉丝", currentUser.followers],
                    ].map(([label, count]) => (
                        <div key={label as string} className="rounded-xl bg-sky-50/70 py-1.5">
                            <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
                            <dd className="font-display text-sm font-extrabold text-slate-700 tabular-nums">
                                {formatCount(count as number)}
                            </dd>
                        </div>
                    ))}
                </dl>

                <button
                    type="button"
                    onClick={() => {
                        openEditProfile();
                        onNavigate?.();
                    }}
                    className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-sky-200 bg-white/60 py-2 text-xs font-bold text-sky-600 transition hover:border-sky-300 hover:bg-sky-50 active:scale-[.98]"
                >
                    <EditIcon size={13} /> 编辑资料
                </button>
            </section>

            <nav className={cn(!flat && "glass-card p-2.5")} aria-label="主菜单">
                <ul className="flex flex-col gap-1">
                    {navItems.map(({ href, label, icon: IconCmp, badge }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                onClick={onNavigate}
                                aria-current={isActive(href) ? "page" : undefined}
                                className={cn(
                                    "group relative flex items-center gap-3 rounded-2xl px-4 py-2.5 font-display text-[15px] font-bold transition-all duration-200",
                                    isActive(href)
                                        ? "bg-gradient-to-r from-sky-100/90 to-blue-50/70 text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:bg-white/80 hover:text-sky-600",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                                        isActive(href)
                                            ? "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/30"
                                            : "bg-white/70 text-slate-400 group-hover:text-sky-500",
                                    )}
                                >
                                    <IconCmp size={18} />
                                </span>
                                {label}
                                {badge ? (
                                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                                        {badge > 99 ? "99+" : badge}
                                    </span>
                                ) : null}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <button
                type="button"
                onClick={() => {
                    openComposer();
                    onNavigate?.();
                }}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 py-3.5 font-display text-[15px] font-extrabold tracking-wide text-white shadow-lg shadow-blue-500/35 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/45 active:scale-[.98]"
            >
                <FeatherIcon size={18} /> 发布新帖
            </button>

            <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] font-semibold text-slate-300">
                <GlobeIcon size={12} /> LightAP · 联邦宇宙小站
            </p>
        </div>
    );
}

export function Sidebar() {
    return (
        <aside
            className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[264px] shrink-0 self-start overflow-y-auto scrollbar-none lg:block"
            aria-label="侧边栏"
        >
            <SidebarContent />
        </aside>
    );
}
