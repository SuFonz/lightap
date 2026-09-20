"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/web/components/ui/avatar";
import { EditIcon, FeatherIcon, GearIcon, GlobeIcon, LockIcon, UserIcon } from "@/web/components/ui/icons";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import { useUi } from "@/web/stores/ui-store";

export default function SettingsPage() {
    const router = useRouter();
    const { isAuthenticated, logout } = useSession();
    const { currentUser } = useDirectory();
    const { openEditProfile, openAuth } = useUi();
    const [loggingOut, setLoggingOut] = useState(false);

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
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <GearIcon size={19} />
                </span>
                <div>
                    <h1 className="font-display text-lg font-black text-slate-800">设置</h1>
                    <p className="text-xs font-medium text-slate-400">管理你的账号与偏好</p>
                </div>
            </section>

            {isAuthenticated ? (
                <>
                    <section className="glass-card p-5" aria-label="账号">
                        <h2 className="mb-4 font-display text-sm font-extrabold text-slate-700">账号</h2>
                        <div className="flex items-center gap-3">
                            <Avatar
                                name={currentUser.displayName}
                                src={currentUser.avatarUrl}
                                size={54}
                                status={currentUser.online}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-[15px] font-extrabold text-slate-800">
                                    {currentUser.displayName}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                    @{currentUser.username}@{currentUser.instance}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openEditProfile}
                                className="btn-solid px-4 py-2 font-display text-sm font-bold"
                            >
                                <EditIcon size={15} /> 编辑资料
                            </button>
                        </div>
                    </section>

                    <section className="glass-card p-5" aria-label="关于">
                        <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
                            <GlobeIcon size={15} className="text-brand-deep" /> 关于
                        </h2>
                        <ul className="flex flex-col gap-2 text-sm text-slate-500">
                            <li className="flex items-center justify-between">
                                <span>实例</span>
                                <span className="font-semibold text-slate-700">{currentUser.instance || "—"}</span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>协议</span>
                                <span className="font-semibold text-slate-700">ActivityPub</span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>版本</span>
                                <span className="font-semibold text-slate-700">LightAP 0.1.0</span>
                            </li>
                        </ul>
                    </section>

                    <section className="glass-card p-5" aria-label="退出登录">
                        <h2 className="mb-1 font-display text-sm font-extrabold text-slate-700">退出登录</h2>
                        <p className="mb-4 text-xs leading-relaxed text-slate-400">
                            退出后本机将清除登录凭证，随时可以重新登录。
                        </p>
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-sakura/40 bg-sakura/10 py-2.5 font-display text-sm font-bold text-sakura-deep transition hover:bg-sakura/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <LockIcon size={15} />
                            {loggingOut ? "正在退出…" : "退出登录"}
                        </button>
                    </section>
                </>
            ) : (
                <section className="glass-card flex flex-col items-center gap-3 px-6 py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                        <UserIcon size={24} />
                    </span>
                    <p className="font-display font-extrabold text-slate-700">登录后即可管理账号</p>
                    <p className="text-sm text-slate-400">注册或登录 LightAP，开始你的联邦宇宙之旅～</p>
                    <div className="mt-1 flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => openAuth("register")}
                            className="btn-solid px-5 py-2.5 font-display text-sm font-bold"
                        >
                            注册
                        </button>
                        <button
                            type="button"
                            onClick={() => openAuth("login")}
                            className="w-full cursor-pointer rounded-xl border border-brand/40 bg-white/50 px-5 py-2.5 font-display text-sm font-bold text-brand-deep transition hover:bg-white/80 active:scale-95"
                        >
                            登录
                        </button>
                    </div>
                </section>
            )}

            <p className="flex items-center justify-center gap-1.5 px-2 pb-2 text-center text-[11px] font-semibold text-slate-400/90">
                <FeatherIcon size={12} /> LightAP · 轻量联邦宇宙小站
            </p>
        </div>
    );
}
