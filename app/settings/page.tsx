"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { ChevronRightIcon, FeatherIcon, GlobeIcon, LockIcon } from "@/web/components/ui/icons";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";

export default function SettingsPage() {
    const router = useRouter();
    const { isAuthenticated, logout } = useSession();
    const { currentUser } = useDirectory();
    const [loggingOut, setLoggingOut] = useState(false);

    // 未登录（例如刚退出）直接回到首页，不再展示登录引导面板
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
        <div className="flex flex-col gap-4">
            <section className="glass-card p-5" aria-label="账号">
                <h2 className="mb-4 font-display text-sm font-extrabold text-slate-700">账号</h2>
                <div className="flex flex-col items-center gap-2">
                    <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={72} ring />
                    <p className="max-w-full truncate font-display text-[15px] font-extrabold text-slate-800">
                        {currentUser.displayName}
                    </p>
                    <p className="max-w-full truncate text-xs text-slate-400">
                        @{currentUser.username}@{currentUser.instance}
                    </p>
                </div>
            </section>

            <Link
                href="/settings/about"
                className="glass-card flex w-full items-center gap-1.5 px-5 py-3 font-display text-sm font-extrabold text-slate-700 transition hover:bg-white/60 active:scale-[0.99]"
            >
                <GlobeIcon size={15} className="text-brand-deep" /> 关于
                <ChevronRightIcon size={16} className="ml-auto text-slate-400" />
            </Link>

            <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-sakura/40 bg-sakura/10 py-2.5 font-display text-sm font-bold text-sakura-deep transition hover:bg-sakura/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <LockIcon size={15} />
                {loggingOut ? "正在退出…" : "退出登录"}
            </button>

            <p className="flex items-center justify-center gap-1.5 px-2 pb-2 text-center text-[11px] font-semibold text-slate-400/90">
                <FeatherIcon size={12} /> LightAP · 轻量联邦宇宙小站
            </p>
        </div>
    );
}
