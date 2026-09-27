"use client";

import { useI18n } from "@/web/lib/i18n";
import { useUi } from "@/web/stores/ui-store";

export function WelcomePanel() {
    const { openAuth } = useUi();
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-4 px-1">
            <div>
                <h2 className="font-display text-xl font-black leading-snug text-brand-ink">{t("welcome.title")}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{t("welcome.text")}</p>
            </div>

            <div className="mt-1 flex flex-col gap-2.5">
                <button
                    type="button"
                    onClick={() => openAuth("register")}
                    className="btn-solid w-full py-2.5 font-display text-sm font-extrabold tracking-wide"
                >
                    {t("common.register")}
                </button>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="w-full cursor-pointer rounded-xl border border-brand/40 bg-white/50 py-2.5 font-display text-sm font-extrabold text-brand-deep transition hover:bg-white/80 hover:shadow-glow active:scale-95"
                >
                    {t("common.login")}
                </button>
            </div>
        </div>
    );
}
