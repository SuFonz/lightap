"use client";

import { useRouter } from "next/navigation";
import { FeatherIcon, GlobeIcon } from "@/web/components/ui/icons";
import { useDirectory } from "@/web/stores/directory";

export default function AboutPage() {
    const router = useRouter();
    const { currentUser } = useDirectory();

    return (
        <div className="flex flex-col gap-3">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="返回"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </button>
                <h1 className="font-display text-lg font-black text-slate-800">关于</h1>
            </section>

            <section className="glass-card flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={26} />
                </span>
                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-display text-lg font-black text-brand-ink">LightAP</h2>
                    <p className="text-sm leading-relaxed text-slate-500">
                        一个可爱的去中心化联邦宇宙小站，基于 ActivityPub 协议，与 Mastodon / Misskey / Pleroma 互联互通。
                    </p>
                </div>
            </section>

            <section className="glass-card p-5" aria-label="关于信息">
                <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
                    <GlobeIcon size={15} className="text-brand-deep" /> 详细信息
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
        </div>
    );
}
