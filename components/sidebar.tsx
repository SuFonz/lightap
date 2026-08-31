"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { WelcomePanel } from "@/components/auth/welcome-panel";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar } from "@/components/avatar";
import {
    // BellIcon,
    EditIcon,
    FeatherIcon,
    GlobeIcon,
    HomeIcon,
    SearchIcon,
    UserIcon,
    // UsersIcon,
} from "@/components/icons";
import { useShell } from "@/components/shell-context";
// import { useNotificationStore } from "@/stores/notification-store";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/client/utils";

interface NavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
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
    const { currentUser } = useUserStore();
    // const { unreadCount } = useNotificationStore();
    const { openComposer, openEditProfile } = useShell();
    const { isAuthenticated } = useAuthStore();

    const navItems: NavItem[] = [
        { href: "/", label: "首页", icon: HomeIcon },
        { href: "/search", label: "搜索", icon: SearchIcon },
        // 功能未实现，暂时注释：
        // { href: "/notifications", label: "通知", icon: BellIcon, badge: unreadCount },
        // { href: "/users", label: "探索", icon: UsersIcon },
        { href: `/u/${currentUser.username}`, label: "我的资料", icon: UserIcon },
    ];

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5 px-1 pt-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={17} />
                </span>
                <span className="font-display text-lg font-black tracking-tight text-brand-ink">
                    LightAP
                </span>
                <span className="ml-auto rounded-full bg-magic/15 px-2 py-0.5 text-[10px] font-extrabold text-magic-deep">
                    Fediverse
                </span>
            </div>

            {isAuthenticated ? (
                <>
                    {/* 用户区：小巧、半透明、不抢内容 */}
                    <section aria-label="个人资料">
                        <div className="flex items-center gap-2.5">
                            <Link
                                href={`/u/${currentUser.username}`}
                                onClick={onNavigate}
                                aria-label="我的资料"
                                className="shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95"
                            >
                                <Avatar
                                    name={currentUser.displayName}
                                    src={currentUser.avatarUrl}
                                    size={46}
                                    status={currentUser.online}
                                />
                            </Link>
                            <Link
                                href={`/u/${currentUser.username}`}
                                onClick={onNavigate}
                                className="min-w-0 flex-1"
                            >
                                <p className="truncate font-display text-[15px] font-extrabold text-slate-800">
                                    {currentUser.displayName}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                    @{currentUser.username}@{currentUser.instance}
                                </p>
                            </Link>
                            <button
                                type="button"
                                aria-label="编辑资料"
                                title="编辑资料"
                                onClick={() => {
                                    openEditProfile();
                                    onNavigate?.();
                                }}
                                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-white/70 hover:text-brand-deep active:scale-90"
                            >
                                <EditIcon size={14} />
                            </button>
                        </div>
                    </section>

                    <nav aria-label="主菜单">
                        <ul className="flex flex-col gap-1">
                            {navItems.map(({ href, label, icon: IconCmp, badge }) => {
                                const active = isActive(href);
                                return (
                                    <li key={href}>
                                        <Link
                                            href={href}
                                            onClick={onNavigate}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-display text-[15px] font-bold transition-all duration-200",
                                                active
                                                    ? "bg-white/75 text-brand-ink shadow-[0_6px_18px_-8px_rgba(59,167,255,0.4)] ring-1 ring-white/80"
                                                    : "text-slate-500 hover:bg-white/50 hover:text-brand-deep",
                                            )}
                                        >
                                            {active && (
                                                <span
                                                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand to-magic"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <IconCmp
                                                size={19}
                                                className={cn(
                                                    "transition-colors",
                                                    active ? "text-brand" : "text-slate-400 group-hover:text-brand-deep",
                                                )}
                                            />
                                            {label}
                                            {badge ? (
                                                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sakura px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                                                    {badge > 99 ? "99+" : badge}
                                                </span>
                                            ) : null}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* 第三层：实体发布按钮 */}
                    <button
                        type="button"
                        onClick={() => {
                            openComposer();
                            onNavigate?.();
                        }}
                        className="btn-solid w-full py-2.5 font-display text-[15px] font-extrabold tracking-wide"
                    >
                        <FeatherIcon size={17} /> 发布新帖
                    </button>

                    <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] font-semibold text-slate-400/90">
                        <GlobeIcon size={12} /> LightAP · 联邦宇宙小站
                    </p>
                </>
            ) : (
                <WelcomePanel />
            )}
        </div>
    );
}

export function Sidebar() {
    return (
        <aside
            className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[240px] shrink-0 self-start overflow-y-auto scrollbar-none lg:block"
            aria-label="侧边栏"
        >
            <SidebarContent />
        </aside>
    );
}
