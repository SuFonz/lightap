"use client";

import { CheckIcon, GlobeIcon } from "@/web/components/ui/icons";
import { useI18n, type TranslationKey } from "@/web/lib/i18n";

const RULES: { title: TranslationKey; text: TranslationKey }[] = [
    { title: "rules.1.title", text: "rules.1.text" },
    { title: "rules.2.title", text: "rules.2.text" },
    { title: "rules.3.title", text: "rules.3.text" },
    { title: "rules.4.title", text: "rules.4.text" },
    { title: "rules.5.title", text: "rules.5.text" },
];

export function CommunityRules() {
    const { t } = useI18n();

    return (
        <section className="row-quiet p-5" aria-label={t("rules.title")}>
            <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-fg">
                <GlobeIcon size={15} className="text-brand-deep" /> {t("rules.title")}
            </h2>
            <ul className="flex flex-col gap-3">
                {RULES.map((rule) => (
                    <li key={rule.title} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                            <CheckIcon size={12} />
                        </span>
                        <div className="min-w-0">
                            <p className="font-display text-[13px] font-bold text-fg">{t(rule.title)}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-fg-weak">{t(rule.text)}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
