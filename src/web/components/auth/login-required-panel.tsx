"use client";

import { FeatherIcon } from "@/web/components/ui/icons";
import { useI18n } from "@/web/lib/i18n";

export function LoginRequiredPanel() {
    const { t } = useI18n();

    return (
        <section className="row-quiet p-4" aria-label={t("composer.title")}>
            <div className="flex items-center gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#6fbaf5] to-[#4a9de0] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={19} />
                </span>
                <input
                    type="text"
                    disabled
                    placeholder={t("composer.placeholder")}
                    aria-label={t("composer.placeholder")}
                    className="min-w-0 flex-1 cursor-default rounded-xl border border-transparent bg-overlay-weak px-4 py-2.5 text-[15px] text-fg opacity-80 placeholder:text-fg-mute"
                />
            </div>
        </section>
    );
}
