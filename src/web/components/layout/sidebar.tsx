"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { WelcomePanel } from "@/web/components/auth/welcome-panel";
import { LanguageSwitcher } from "@/web/components/layout/language-switcher";
import { ThemeSwitcher } from "@/web/components/layout/theme-switcher";
import { Avatar } from "@/web/components/ui/avatar";
import { BellIcon, EditIcon, FeatherIcon, GearIcon, GithubIcon, HomeIcon, SearchIcon, UserIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { useDirectory } from "@/web/stores/directory";
import { useNotifications } from "@/web/stores/notifications-store";
import { useSession } from "@/web/stores/session-store";
import { useUi } from "@/web/stores/ui-store";

interface NavItem {
    href: string;
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
}

/** 真实仓库地址 */
const GITHUB_URL = "https://github.com/SuFonz/lightap";

/**
 * 左栏：平面，没有卡片边界。
 * 品牌、用户、导航、发布按钮、底部工具直接排在页面底色上。
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { isAuthenticated } = useSession();
    const { currentUser } = useDirectory();
    const { openComposer, openEditProfile } = useUi();
    const { unreadCount } = useNotifications();
    const { t } = useI18n();

    const navItems: NavItem[] = [
        { href: "/", label: t("nav.home"), icon: HomeIcon },
        { href: "/search", label: t("nav.search"), icon: SearchIcon },
        { href: "/notifications", label: t("nav.notifications"), icon: BellIcon },
        { href: `/u/${currentUser.username}`, label: t("nav.profile"), icon: UserIcon },
        { href: "/settings", label: t("nav.settings"), icon: GearIcon },
    ];

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <div className="flex h-full flex-col gap-5">
            {/* 品牌 */}
            <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-deep text-white">
                    <FeatherIcon size={17} />
                </span>
                <span className="font-display text-lg font-extrabold tracking-tight text-fg">LightAP</span>
                <span className="ml-auto rounded-full bg-overlay px-2 py-0.5 text-[10px] font-bold text-fg-mute">
                    {t("app.fediverse")}
                </span>
            </div>

            {isAuthenticated ? (
                <>
                    {/* 用户区：没有边框，靠头像和间距组织 */}
                    <section aria-label={t("nav.profile")} className="flex items-center gap-2.5">
                        <Link
                            href={`/u/${currentUser.username}`}
                            onClick={onNavigate}
                            aria-label={t("nav.profile")}
                            className="shrink-0 transition-opacity duration-150 hover:opacity-80"
                        >
                            <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={38} />
                        </Link>
                        <Link
                            href={`/u/${currentUser.username}`}
                            onClick={onNavigate}
                            className="min-w-0 flex-1 transition-opacity duration-150 hover:opacity-80"
                        >
                            <p className="truncate font-display text-[13px] font-bold text-fg">
                                {currentUser.displayName}
                            </p>
                            <p className="truncate text-[11px] text-fg-mute">@{currentUser.username}</p>
                        </Link>
                        <button
                            type="button"
                            aria-label={t("nav.editProfile")}
                            title={t("nav.editProfile")}
                            onClick={() => {
                                openEditProfile();
                                onNavigate?.();
                            }}
                            className="press-sm flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-mute transition-colors hover:bg-overlay hover:text-brand-deep"
                        >
                            <EditIcon size={13} />
                        </button>
                    </section>

                    <nav aria-label={t("nav.mainMenu")}>
                        <ul className="flex flex-col gap-1">
                            {navItems.map(({ href, label, icon: IconCmp }) => {
                                const active = isActive(href);
                                return (
                                    <li key={href}>
                                        <Link
                                            href={href}
                                            onClick={onNavigate}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "press-sm group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-[14px] font-bold transition-colors duration-150",
                                                active
                                                    ? // 选中态：只用强调色底色与文字，不加投影
                                                      "bg-brand/10 text-brand-ink"
                                                    : "text-fg-weak hover:bg-overlay hover:text-fg",
                                            )}
                                        >
                                            <IconCmp
                                                size={18}
                                                className={cn(
                                                    "transition-colors duration-150",
                                                    active ? "text-brand" : "text-fg-mute group-hover:text-fg-weak",
                                                )}
                                            />
                                            {label}
                                            {href === "/notifications" && unreadCount > 0 && (
                                                <span className="ml-auto rounded-full bg-brand-deep px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                                                    {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* 发布按钮：页面上少数的实体元素之一 */}
                    <button
                        type="button"
                        onClick={() => {
                            openComposer();
                            onNavigate?.();
                        }}
                        className="btn-solid w-full py-2.5 font-display text-[13px] font-bold"
                    >
                        <FeatherIcon size={15} /> {t("nav.publish")}
                    </button>
                </>
            ) : (
                <WelcomePanel />
            )}

            {/* 底部工具条：语言 / 外观 / GitHub 三个图标并排一行，不显示文字。
                未登录也能切深浅色，所以放在侧栏而不是设置页里。 */}
            <div className="mt-auto flex items-center gap-0.5 pt-6">
                <LanguageSwitcher />
                <ThemeSwitcher />
                <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub"
                    title="GitHub"
                    className="press-sm flex h-8 w-8 items-center justify-center rounded-lg text-fg-mute transition-colors hover:bg-overlay hover:text-fg-weak"
                >
                    <GithubIcon size={15} />
                </a>
            </div>
        </div>
    );
}

export function Sidebar() {
    const { t } = useI18n();

    return (
        <aside
            className="sticky top-8 z-20 hidden max-h-[calc(100dvh-4rem)] w-[208px] shrink-0 self-start overflow-y-auto scrollbar-none lg:block"
            aria-label={t("nav.sidebar")}
        >
            <SidebarContent />
        </aside>
    );
}
