"use client";

import { useI18n } from "@/web/lib/i18n";
import { useUi } from "@/web/stores/ui-store";

export function WelcomePanel() {
    const { openAuth } = useUi();
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="font-display text-[17px] font-extrabold leading-snug text-fg">{t("welcome.title")}</h2>
                <p className="mt-1.5 text-[12px] leading-relaxed text-fg-weak">{t("welcome.text")}</p>
            </div>

            <div className="mt-1 flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => openAuth("register")}
                    className="btn-solid w-full py-2.5 font-display text-[13px] font-bold"
                >
                    {t("common.register")}
                </button>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="btn-ghost w-full border border-line py-2.5 font-display text-[13px] font-bold text-brand-ink"
                >
                    {t("common.login")}
                </button>
            </div>
        </div>
    );
}
