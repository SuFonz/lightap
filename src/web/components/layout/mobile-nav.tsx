"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { SidebarContent } from "@/web/components/layout/sidebar";
import { Avatar } from "@/web/components/ui/avatar";
import { CountBadge } from "@/web/components/ui/count-badge";
import { BellIcon, FeatherIcon, GearIcon, HomeIcon, MenuIcon, SearchIcon, UserIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { useDirectory } from "@/web/stores/directory";
import { useNotifications } from "@/web/stores/notifications-store";
import { useSession } from "@/web/stores/session-store";
import { useUi } from "@/web/stores/ui-store";

export function MobileTopBar() {
    const { setDrawerOpen } = useUi();
    const { isAuthenticated } = useSession();
    const { currentUser } = useDirectory();
    const { unreadCount } = useNotifications();
    const { t } = useI18n();

    return (
        <header className="bar-surface fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b px-4 py-2.5 lg:hidden">
            <button
                type="button"
                aria-label={t("nav.openMenu")}
                onClick={() => setDrawerOpen(true)}
                className="press-sm -ml-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-fg-weak transition-colors hover:bg-overlay"
            >
                <MenuIcon size={21} />
            </button>

            <Link href="/" className="flex items-center gap-1.5" aria-label={t("app.name")}>
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-deep text-white">
                    <FeatherIcon size={16} />
                </span>
                <span className="font-display text-[17px] font-extrabold tracking-tight text-fg">LightAP</span>
            </Link>

            <div className="ml-auto flex items-center gap-0.5">
                <Link
                    href="/search"
                    aria-label={t("nav.search")}
                    className="press-sm flex h-10 w-10 items-center justify-center rounded-full text-fg-weak transition-colors hover:bg-overlay"
                >
                    <SearchIcon size={20} />
                </Link>
                {isAuthenticated && (
                    <Link
                        href="/notifications"
                        aria-label={t("nav.notifications")}
                        className="press-sm relative flex h-10 w-10 items-center justify-center rounded-full text-fg-weak transition-colors hover:bg-overlay"
                    >
                        <BellIcon size={20} />
                        <CountBadge
                            count={unreadCount}
                            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center px-1 text-[9px]"
                        />
                    </Link>
                )}
                {isAuthenticated && (
                    <Link href={`/u/${currentUser.username}`} aria-label={t("nav.profile")} className="ml-1">
                        <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={32} />
                    </Link>
                )}
            </div>
        </header>
    );
}

interface BottomNavItem {
    href: string;
    label: string;
    /** className 用于激活态动画（nav-pop） */
    icon: ComponentType<{ size?: number; className?: string }>;
}

function BottomNavLink({
    item,
    active,
    badge = 0,
    pathname,
}: {
    item: BottomNavItem;
    active: boolean;
    badge?: number;
    /** 当前路由，用于让激活项的图标重播弹动 */
    pathname: string;
}) {
    const IconCmp = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
                // 不再用 transition-colors：它会覆盖 nav-press 里的 transform 过渡，
                // 导致按下是瞬间跳变（看起来像只有两帧）。颜色过渡由 nav-press 统一声明。
                "nav-press flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1 text-[10px] font-bold",
                active ? "text-brand-ink" : "text-fg-mute",
            )}
        >
            <span className={cn("relative rounded-full p-1 transition-colors", active && "bg-brand/12")}>
                {/* key 带上 pathname：路由一变，激活项图标重播 nav-pop */}
                <IconCmp key={active ? `active-${pathname}` : "idle"} size={20} className={cn(active && "nav-pop")} />
                <CountBadge
                    count={badge}
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 text-[9px]"
                />
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
    const { unreadCount } = useNotifications();
    const { t } = useI18n();

    const items: BottomNavItem[] = [
        { href: "/", label: t("nav.home"), icon: HomeIcon },
        { href: "/search", label: t("nav.search"), icon: SearchIcon },
        ...(isAuthenticated
            ? [
                  { href: "/notifications", label: t("nav.notifications"), icon: BellIcon },
                  { href: `/u/${currentUser.username}`, label: t("nav.me"), icon: UserIcon },
                  { href: "/settings", label: t("nav.settings"), icon: GearIcon },
              ]
            : []),
    ];

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <nav
            className="bar-surface fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden"
            aria-label={t("nav.bottomNav")}
        >
            {items.slice(0, 2).map((item) => (
                <BottomNavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    badge={item.href === "/notifications" ? unreadCount : 0}
                    pathname={pathname}
                />
            ))}

            {isAuthenticated && (
                <div className="flex w-16 justify-center">
                    {/* FAB：页面上唯一有强投影的元素 */}
                    <button
                        type="button"
                        onClick={openComposer}
                        aria-label={t("nav.publish")}
                        className="fab -mt-6 h-13 w-13 h-[52px] w-[52px]"
                    >
                        <FeatherIcon size={22} />
                    </button>
                </div>
            )}

            {items.slice(2).map((item) => (
                <BottomNavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    badge={item.href === "/notifications" ? unreadCount : 0}
                    pathname={pathname}
                />
            ))}
        </nav>
    );
}

export function MobileDrawer() {
    const { drawerOpen, setDrawerOpen } = useUi();
    const { t } = useI18n();

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden",
                drawerOpen ? "visible" : "invisible",
            )}
            role="dialog"
            aria-modal={drawerOpen}
            aria-label={t("nav.mainMenu")}
            aria-hidden={!drawerOpen}
        >
            {/* 遮罩 */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/25 transition-opacity duration-200",
                    drawerOpen ? "opacity-100" : "opacity-0",
                )}
                onClick={() => setDrawerOpen(false)}
            />

            {/* 抽屉：需要独立层级，用实体表面。
                只在 transform 上做过渡，不碰 left/width，避免抽屉滑动时重排。 */}
            <div
                className={cn(
                    "surface-raised absolute bottom-0 left-0 top-0 w-[286px] max-w-[84vw] overflow-y-auto rounded-l-none rounded-r-2xl border-y-0 border-l-0 p-5 pr-6 pt-[max(env(safe-area-inset-top),20px)]",
                    "transition-transform duration-300 ease-[cubic-bezier(.32,.72,.35,1)]",
                    drawerOpen ? "translate-x-0" : "-translate-x-full",
                )}
            >
                <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
        </div>
    );
}
