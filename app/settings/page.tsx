"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { ChevronRightIcon, FeatherIcon, GlobeIcon, LockIcon } from "@/web/components/ui/icons";
import { LanguageSwitcher } from "@/web/components/layout/language-switcher";
import { ThemeSection } from "@/web/components/settings/theme-section";
import { useI18n } from "@/web/lib/i18n";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";

/**
 * 设置页：平面布局，没有卡片。
 * 分区靠标题 + 间距 + hairline 区分。
 */
export default function SettingsPage() {
    const router = useRouter();
    const { isAuthenticated, logout } = useSession();
    const { currentUser } = useDirectory();
    const { t } = useI18n();
    const [loggingOut, setLoggingOut] = useState(false);

    // 未登录（例如刚退出）直接回到首页
    useEffect(() => {
        if (!isAuthenticated) router.replace("/");
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    async function handleLogout() {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await logout();
            router.push("/");
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <div className="flex flex-col">
            <header className="sticky-head -mx-1 px-1 pb-2 pt-1.5">
                <h1 className="font-display text-[15px] font-extrabold text-fg">{t("nav.settings")}</h1>
            </header>

            <div className="divided mt-1">
                {/* 账号 */}
                <section className="py-5" aria-label={t("settings.account")}>
                    <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-fg-mute">
                        {t("settings.account")}
                    </h2>
                    <div className="flex items-center gap-3">
                        <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={48} ring />
                        <div className="min-w-0">
                            <p className="max-w-full truncate font-display text-[14px] font-bold text-fg">
                                {currentUser.displayName}
                            </p>
                            <p className="max-w-full truncate text-[11px] text-fg-mute">
                                @{currentUser.username}@{currentUser.instance}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 外观：主题模式 + 强调色 */}
                <ThemeSection />

                {/* 语言 */}
                <section className="py-5" aria-label={t("language.label")}>
                    <h2 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-fg-mute">
                        {t("language.label")}
                    </h2>
                    <LanguageSwitcher variant="rail" />
                </section>

                {/* 关于 */}
                <section className="py-2" aria-label={t("settings.about")}>
                    <Link
                        href="/settings/about"
                        className="row -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-3"
                    >
                        <GlobeIcon size={15} className="text-fg-mute" />
                        <span className="font-display text-[13px] font-bold text-fg">{t("settings.about")}</span>
                        <ChevronRightIcon size={15} className="ml-auto text-fg-mute" />
                    </Link>
                </section>

                {/* 退出 */}
                <section className="py-4">
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="press-sm inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line py-2.5 font-display text-[12px] font-bold text-fg-weak transition-colors hover:border-red-400/40 hover:bg-red-500/5 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <LockIcon size={13} />
                        {loggingOut ? t("common.loggingOut") : t("common.logout")}
                    </button>

                    <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] font-medium text-fg-mute">
                        <FeatherIcon size={10} /> {t("app.footerShort")}
                    </p>
                </section>
            </div>
        </div>
    );
}
