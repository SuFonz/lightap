"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { SidebarContent } from "@/web/components/layout/sidebar";
import { Avatar } from "@/web/components/ui/avatar";
import { FeatherIcon, GearIcon, HomeIcon, MenuIcon, SearchIcon, UserIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import { useUi } from "@/web/stores/ui-store";

export function MobileTopBar() {
    const { setDrawerOpen } = useUi();
    const { isAuthenticated } = useSession();
    const { currentUser } = useDirectory();

    return (
        <header className="glass-bar fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-4 py-2.5 lg:hidden">
            <button
                type="button"
                aria-label="打开菜单"
                onClick={() => setDrawerOpen(true)}
                className="-ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-600 transition active:scale-90"
            >
                <MenuIcon size={22} />
            </button>

            <Link href="/" className="flex items-center gap-1.5" aria-label="LightAP 首页">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={16} />
                </span>
                <span className="font-display text-lg font-black tracking-tight text-brand-ink">LightAP</span>
            </Link>

            <div className="ml-auto flex items-center gap-0.5">
                <Link
                    href="/search"
                    aria-label="搜索"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-brand-deep"
                >
                    <SearchIcon size={21} />
                </Link>
                {isAuthenticated && (
                    <Link href={`/u/${currentUser.username}`} aria-label="我的资料" className="ml-1">
                        <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={34} />
                    </Link>
                )}
            </div>
        </header>
    );
}

interface BottomNavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
}

function BottomNavLink({ item, active }: { item: BottomNavItem; active: boolean }) {
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
            </span>
            {item.label}
        </Link>
    );
}

export function MobileBottomNav() {
    const pathname = usePathname();
    const { openComposer } = useUi();
    const { isAuthenticated } = useSession();
    const { currentUser } = useDirectory();

    const items: BottomNavItem[] = [
        { href: "/", label: "首页", icon: HomeIcon },
        { href: "/search", label: "搜索", icon: SearchIcon },
        ...(isAuthenticated
            ? [
                  { href: `/u/${currentUser.username}`, label: "我的", icon: UserIcon },
                  { href: "/settings", label: "设置", icon: GearIcon },
              ]
            : []),
    ];

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <nav
            className="glass-bar fixed inset-x-0 bottom-0 z-40 flex items-end justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden"
            aria-label="底部导航"
        >
            {items.slice(0, 2).map((item) => (
                <BottomNavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}

            {isAuthenticated && (
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
            )}

            {items.slice(2).map((item) => (
                <BottomNavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
        </nav>
    );
}

export function MobileDrawer() {
    const { drawerOpen, setDrawerOpen } = useUi();

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden",
                drawerOpen ? "visible" : "invisible",
            )}
            role="dialog"
            aria-modal={drawerOpen}
            aria-label="菜单"
            aria-hidden={!drawerOpen}
        >
            <div
                className={cn(
                    "absolute inset-0 bg-brand-ink/25 backdrop-blur-sm transition-opacity duration-200",
                    drawerOpen ? "opacity-100" : "opacity-0",
                )}
                onClick={() => setDrawerOpen(false)}
            />
            <div
                className={cn(
                    "absolute bottom-0 left-0 top-0 w-[290px] max-w-[85vw] overflow-y-auto rounded-r-3xl border-r border-white/60 bg-gradient-to-br from-white via-[#f2f9ff] to-[#e0edfd] p-5 pr-6 pt-[max(env(safe-area-inset-top),20px)] shadow-2xl shadow-brand/25 backdrop-blur-2xl",
                    "transition-transform duration-300 ease-[cubic-bezier(.32,.72,.35,1)]",
                    drawerOpen ? "translate-x-0" : "-translate-x-full",
                )}
            >
                <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
        </div>
    );
}
