"use client";

import { useRef, useState } from "react";
import { CheckIcon, GlobeIcon } from "@/web/components/ui/icons";
import { Popover } from "@/web/components/ui/popover";
import { cn } from "@/web/lib/cn";
import { useI18n, type Locale, type TranslationKey } from "@/web/lib/i18n";

const OPTIONS: { value: Locale; labelKey: TranslationKey; short: string }[] = [
    { value: "zh", labelKey: "language.zh", short: "中" },
    { value: "en", labelKey: "language.en", short: "EN" },
    { value: "ja", labelKey: "language.ja", short: "日" },
];

/**
 * 语言切换：纯图标按钮 + 上拉菜单。
 *
 * 图标按钮不显示当前语言的名字，只在右下角标一个小徽标，
 * 这样底部工具条可以三个按钮并排放在一行里。
 */
export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "rail" }) {
    const { locale, setLocale, t } = useI18n();
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const current = OPTIONS.find((o) => o.value === locale) ?? OPTIONS[0];

    return (
        <>
            <button
                type="button"
                ref={anchorRef}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("language.label")}
                title={t("language.label")}
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    "press-sm relative flex cursor-pointer items-center justify-center rounded-lg text-fg-mute transition-colors hover:bg-overlay hover:text-fg-weak",
                    variant === "rail"
                        ? "w-full justify-start gap-2 px-3 py-2 text-[13px] font-bold"
                        : "h-8 w-8",
                )}
            >
                <GlobeIcon size={15} />
                {variant === "rail" && <span>{t("language.label")}</span>}

                {/* 小徽标：用两个字母表示当前语言，不占横向空间 */}
                {variant === "icon" && (
                    <span className="absolute -bottom-0.5 -right-0.5 rounded bg-surface px-0.5 text-[8px] font-bold leading-[10px] text-fg-mute">
                        {current.short}
                    </span>
                )}
                {variant === "rail" && (
                    <span className="ml-auto text-[11px] font-semibold text-fg-mute">{current.short}</span>
                )}
            </button>

            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchorRef={anchorRef}
                direction="right"
                align="left"
                width={148}
                className="surface-raised overflow-hidden p-1"
            >
                <div role="menu" className="flex flex-col gap-0.5">
                    {OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={locale === option.value}
                            onClick={() => {
                                setLocale(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition-colors",
                                locale === option.value
                                    ? "bg-brand/10 text-brand-ink"
                                    : "text-fg-weak hover:bg-overlay",
                            )}
                        >
                            {t(option.labelKey)}
                            {locale === option.value && <CheckIcon size={11} strokeWidth={3} className="ml-auto" />}
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}
