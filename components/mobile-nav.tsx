"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Avatar } from "@/components/avatar";
import {
    BellIcon,
    FeatherIcon,
    HomeIcon,
    SearchIcon,
    UserIcon,
} from "@/components/icons";
import { useShell } from "@/components/shell-context";
import { SidebarContent } from "@/components/sidebar";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

export function MobileTopBar() {
    const { setDrawerOpen } = useShell();
    const { currentUser, unreadCount } = useStore();

    return (
        <header className="glass-bar fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-4 py-2.5 lg:hidden">
            <button
                type="button"
                aria-label="打开菜单"
                onClick={() => setDrawerOpen(true)}
                className="-ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-600 transition active:scale-90"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="14" y1="18" y2="18" />
                </svg>
            </button>

            <Link href="/" className="flex items-center gap-1.5" aria-label="LightAP 首页">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={16} />
                </span>
                <span className="font-display text-lg font-black tracking-tight text-brand-ink">
                    LightAP
                </span>
            </Link>

            <div className="ml-auto flex items-center gap-0.5">
                <Link
                    href="/search"
                    aria-label="搜索"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-brand-deep"
                >
                    <SearchIcon size={21} />
                </Link>
                <Link
                    href="/notifications"
                    aria-label={`通知，${unreadCount} 条未读`}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-brand-deep"
                >
                    <BellIcon size={21} />
                    {unreadCount > 0 && (
                        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sakura" aria-hidden="true" />
                    )}
                </Link>
                <Link href={`/u/${currentUser.username}`} aria-label="我的资料" className="ml-1">
                    <Avatar
                        name={currentUser.displayName}
                        src={currentUser.avatarUrl}
                        size={34}
                        status={currentUser.online}
                    />
                </Link>
            </div>
        </header>
    );
}

interface BottomNavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
    badge?: number;
}

export function MobileBottomNav() {
    const pathname = usePathname();
    const { openComposer } = useShell();
    const { unreadCount, currentUser } = useStore();

    const profileHref = `/u/${currentUser.username}`;
    const items: BottomNavItem[] = [
        { href: "/", label: "首页", icon: HomeIcon },
        { href: "/search", label: "搜索", icon: SearchIcon },
        { href: "/notifications", label: "通知", icon: BellIcon, badge: unreadCount },
        { href: profileHref, label: "我的", icon: UserIcon },
    ];

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <nav
            className="glass-bar fixed inset-x-0 bottom-0 z-40 flex items-end justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden"
            aria-label="底部导航"
        >
            {items.slice(0, 2).map((item) => (
                <BottomNavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}

            <div className="flex w-16 justify-center">
                <button
                    type="button"
                    onClick={openComposer}
                    aria-label="发布新帖"
                    className="-mt-7 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-xl shadow-brand/50 ring-4 ring-white/70 transition-all duration-200 hover:-translate-y-1 active:scale-90"
                >
                    <FeatherIcon size={23} />
                </button>
            </div>

            {items.slice(2).map((item) => (
                <BottomNavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
        </nav>
    );
}

function BottomNavLink({
    item,
    active,
}: {
    item: BottomNavItem;
    active: boolean;
}) {
    const IconCmp = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
                "flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1 text-[10px] font-bold transition-colors",
                active ? "text-brand-deep" : "text-slate-400",
            )}
        >
            <span className={cn("relative rounded-full p-1", active && "bg-brand/15")}>
                <IconCmp size={21} />
                {item.badge ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white/90 bg-sakura" aria-hidden="true" />
                ) : null}
            </span>
            {item.label}
        </Link>
    );
}

export function MobileDrawer() {
    const { drawerOpen, setDrawerOpen } = useShell();

    if (!drawerOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="菜单"
        >
            <div
                className="absolute inset-0 bg-brand-ink/25 backdrop-blur-sm"
                style={{ animation: "fade-in .2s ease-out" }}
                onClick={() => setDrawerOpen(false)}
            />
            <div
                className="absolute bottom-0 left-0 top-0 w-[290px] max-w-[85vw] overflow-y-auto rounded-r-3xl border-r border-white/60 bg-gradient-to-br from-white via-[#f2f9ff] to-[#e0edfd] p-5 pr-6 pt-[max(env(safe-area-inset-top),20px)] shadow-2xl shadow-brand/25 backdrop-blur-2xl"
                style={{ animation: "slide-in-left .28s cubic-bezier(.32,.72,.35,1)" }}
            >
                <SidebarContent flat onNavigate={() => setDrawerOpen(false)} />
            </div>
        </div>
    );
}
