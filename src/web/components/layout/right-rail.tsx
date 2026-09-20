"use client";

import { CommunityRules } from "@/web/components/auth/community-rules";
import { SearchBox } from "@/web/components/search/search-box";
import { GlobeIcon } from "@/web/components/ui/icons";
import { useSession } from "@/web/stores/session-store";

export function RightRail() {
    const { isAuthenticated } = useSession();

    return (
        <aside
            className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[280px] shrink-0 flex-col gap-4 self-start overflow-y-auto scrollbar-none xl:flex"
            aria-label="标签栏"
        >
            <SearchBox />

            {isAuthenticated ? (
                <p className="flex items-start justify-center gap-1.5 px-2 pb-4 text-center text-[11px] leading-relaxed text-slate-400/90">
                    <GlobeIcon size={12} className="mt-0.5 shrink-0" />
                    基于 ActivityPub 协议 · 与 Mastodon / Misskey / Pleroma 互联互通
                </p>
            ) : (
                <CommunityRules />
            )}
        </aside>
    );
}
