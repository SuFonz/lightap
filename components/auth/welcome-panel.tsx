"use client";

import { useShell } from "@/components/shell-context";

export function WelcomePanel() {
    const { openAuth } = useShell();

    return (
        <div className="flex flex-col gap-4 px-1">
            <div>
                <h2 className="font-display text-xl font-black leading-snug text-brand-ink">
                    欢迎来到 LightAP
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    一个可爱又轻量的联邦宇宙小站。注册或登录后，就能发布动态、关注感兴趣的朋友啦～
                </p>
            </div>

            <div className="mt-1 flex flex-col gap-2.5">
                <button
                    type="button"
                    onClick={() => openAuth("register")}
                    className="btn-solid w-full py-2.5 font-display text-sm font-extrabold tracking-wide"
                >
                    注册
                </button>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="w-full cursor-pointer rounded-xl border border-brand/40 bg-white/50 py-2.5 font-display text-sm font-extrabold text-brand-deep transition hover:bg-white/80 hover:shadow-glow active:scale-95"
                >
                    登录
                </button>
            </div>
        </div>
    );
}
