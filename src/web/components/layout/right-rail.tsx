"use client";

import { CommunityRules } from "@/web/components/auth/community-rules";
import { SearchBox } from "@/web/components/search/search-box";
import { useI18n } from "@/web/lib/i18n";
import { useSession } from "@/web/stores/session-store";

/**
 * 右栏：平面，没有卡片。
 * 搜索框 + 社区规则（未登录）或实例说明（登录后）。
 */
export function RightRail() {
 const { isAuthenticated } = useSession();
 const { t } = useI18n();

 return (
 <aside
 className="sticky top-8 z-20 hidden max-h-[calc(100dvh-4rem)] w-[240px] shrink-0 flex-col gap-6 self-start overflow-y-auto scrollbar-none xl:flex"
 aria-label={t("nav.rightRail")}
 >
 <SearchBox />

 {isAuthenticated ? (
 <div className="rounded-xl bg-overlay-weak px-3.5 py-3">
 <p className="text-[11px] leading-relaxed text-fg-mute">{t("app.protocolNote")}</p>
 </div>
 ) : (
 <CommunityRules />
 )}
 </aside>
 );
}
