"use client";

import { useRef, useState } from "react";
import { MoonIcon, PaletteIcon, SunIcon } from "@/web/components/ui/icons";
import { Popover } from "@/web/components/ui/popover";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { ACCENT_PRESETS, useTheme, type ThemeMode } from "@/web/stores/theme-store";

const MODES: {
    value: ThemeMode;
    key: "settings.theme.light" | "settings.theme.dark" | "settings.theme.system";
    Icon: typeof SunIcon;
}[] = [
    { value: "light", key: "settings.theme.light", Icon: SunIcon },
    { value: "dark", key: "settings.theme.dark", Icon: MoonIcon },
    { value: "system", key: "settings.theme.system", Icon: PaletteIcon },
];

/**
 * 外观切换：纯图标按钮 + 上拉菜单。
 *
 * 按钮本身只显示一个随明暗变化的图标（太阳 / 月亮），不写文字，
 * 这样底部工具条能把语言、外观、GitHub 三个按钮并排塞进一行。
 */
export function ThemeSwitcher({ variant = "icon" }: { variant?: "icon" | "rail" }) {
    const { t } = useI18n();
    const { mode, accentHue, resolvedMode, setMode, setAccentHue } = useTheme();
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const isDark = resolvedMode === "dark";
    const CurrentIcon = isDark ? MoonIcon : SunIcon;

    return (
        <>
            <button
                type="button"
                ref={anchorRef}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("settings.appearance")}
                title={t("settings.appearance")}
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    "press-sm flex cursor-pointer items-center justify-center rounded-lg text-fg-mute transition-colors hover:bg-overlay hover:text-fg-weak",
                    variant === "rail" ? "w-full justify-start gap-2 px-3 py-2 text-[13px] font-bold" : "h-8 w-8",
                )}
            >
                <CurrentIcon size={15} />
                {variant === "rail" && (
                    <span>{isDark ? t("settings.theme.dark") : t("settings.theme.light")}</span>
                )}
            </button>

            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchorRef={anchorRef}
                direction="right"
                align="left"
                width={188}
                className="surface-raised overflow-hidden p-1"
            >
                <div role="menu" className="flex flex-col gap-0.5">
                    {MODES.map(({ value, key, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={mode === value}
                            onClick={() => {
                                setMode(value);
                                setOpen(false);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition-colors",
                                mode === value ? "bg-brand/10 text-brand-ink" : "text-fg-weak hover:bg-overlay",
                            )}
                        >
                            <Icon size={12} />
                            {t(key)}
                        </button>
                    ))}
                </div>

                <div className="mt-1 border-t border-line px-1 pb-1 pt-2">
                    <div className="flex items-center gap-1.5">
                        {ACCENT_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => setAccentHue(preset.hue)}
                                aria-label={t("settings.accentPick", { name: preset.key })}
                                aria-pressed={accentHue === preset.hue}
                                className={cn(
                                    "press-sm h-[18px] w-[18px] cursor-pointer rounded-full transition-transform",
                                    accentHue === preset.hue && "scale-110",
                                )}
                                style={{
                                    background: `hsl(${preset.hue} 90% 52%)`,
                                    boxShadow:
                                        accentHue === preset.hue
                                            ? `0 0 0 2px var(--surface-bg), 0 0 0 3px hsl(${preset.hue} 90% 52%)`
                                            : "inset 0 1px 0 rgba(255,255,255,0.25)",
                                }}
                            />
                        ))}
                    </div>
                </div>
            </Popover>
        </>
    );
}
