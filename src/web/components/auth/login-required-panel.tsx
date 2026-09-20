"use client";

import { FeatherIcon } from "@/web/components/ui/icons";

export function LoginRequiredPanel() {
    return (
        <section className="glass-card p-4" aria-label="发帖框（未启用）">
            <div className="flex items-center gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={19} />
                </span>
                <input
                    type="text"
                    disabled
                    placeholder="说点什么吧…"
                    aria-label="说点什么吧…（登录后可用）"
                    className="min-w-0 flex-1 cursor-default rounded-xl border border-transparent bg-white/55 px-4 py-2.5 text-[15px] text-slate-700 opacity-80 placeholder:text-slate-400"
                />
            </div>
        </section>
    );
}
