"use client";

import { useRef, useState } from "react";
import { GlobeIcon } from "@/web/components/ui/icons";
import { Popover } from "@/web/components/ui/popover";
import { cn } from "@/web/lib/cn";
import { useI18n, type Locale, type TranslationKey } from "@/web/lib/i18n";

const OPTIONS: { value: Locale; labelKey: TranslationKey }[] = [
    { value: "zh", labelKey: "language.zh" },
    { value: "en", labelKey: "language.en" },
];

/** 语言切换：右侧栏底部的上拉菜单 */
export function LanguageSwitcher() {
    const { locale, setLocale, t } = useI18n();
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const currentKey: TranslationKey = locale === "en" ? "language.en" : "language.zh";

    return (
        <>
            <button
                type="button"
                ref={anchorRef}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="glass-card flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:text-brand-deep"
            >
                <GlobeIcon size={15} className="shrink-0 text-brand" />
                {t("language.label")}
                <span className="ml-auto text-xs font-semibold text-slate-400">{t(currentKey)}</span>
            </button>

            <Popover
                open={open}
                anchorRef={anchorRef}
                direction="up"
                align="left"
                className="glass-strong overflow-hidden p-1.5"
            >
                <div role="menu" onClick={() => setOpen(false)} className="flex flex-col">
                    {OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={locale === option.value}
                            onClick={() => setLocale(option.value)}
                            className={cn(
                                "flex w-full cursor-pointer items-center rounded-[10px] px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-white/80",
                                locale === option.value ? "text-brand-deep" : "text-slate-600",
                            )}
                        >
                            {t(option.labelKey)}
                            {locale === option.value && <span className="ml-auto">✓</span>}
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}
