"use client";

import { useI18n } from "@/web/lib/i18n";
import { cn } from "@/web/lib/cn";
import { ACCENT_PRESETS, useTheme, type ThemeMode } from "@/web/stores/theme-store";
import { CheckIcon, MoonIcon, PaletteIcon, SunIcon } from "@/web/components/ui/icons";

const MODES: {
    value: ThemeMode;
    key: "settings.theme.light" | "settings.theme.dark" | "settings.theme.system";
    Icon: typeof SunIcon;
}[] = [
    { value: "light", key: "settings.theme.light", Icon: SunIcon },
    { value: "dark", key: "settings.theme.dark", Icon: MoonIcon },
    { value: "system", key: "settings.theme.system", Icon: PaletteIcon },
];

/** 外观设置：主题模式 + 强调色。改 CSS 变量，全站即时生效。 */
export function ThemeSection() {
    const { t } = useI18n();
    const { mode, accentHue, resolvedMode, setMode, setAccentHue } = useTheme();

    return (
        <section className="py-5" aria-label={t("settings.appearance")}>
            <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-fg-mute">
                {t("settings.appearance")}
            </h2>

            {/* 明暗模式：三档分段控件 */}
            <div className="flex gap-1 rounded-lg bg-overlay-weak p-1">
                {MODES.map(({ value, key, Icon }) => {
                    const active = mode === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setMode(value)}
                            aria-pressed={active}
                            className={cn(
                                "press-sm relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[0.45rem] py-1.5 font-display text-[12px] font-bold transition-colors duration-150",
                                active ? "text-brand-ink" : "text-fg-mute hover:text-fg-weak",
                            )}
                        >
                            {active && (
                                <span className="absolute inset-0 rounded-[0.45rem] bg-surface shadow-[0_1px_3px_rgba(23,60,102,0.1)]" />
                            )}
                            <span className="relative flex items-center gap-1.5">
                                <Icon size={12} />
                                {t(key)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* 强调色 */}
            <div className="mt-4 flex items-center gap-2.5">
                <span className="text-[11px] font-semibold text-fg-mute">{t("settings.accent")}</span>
                {ACCENT_PRESETS.map((preset) => {
                    const active = accentHue === preset.hue;
                    return (
                        <button
                            key={preset.key}
                            type="button"
                            onClick={() => setAccentHue(preset.hue)}
                            aria-label={t("settings.accentPick", { name: preset.key })}
                            aria-pressed={active}
                            className={cn(
                                "press-sm flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform duration-150",
                                active && "scale-110",
                            )}
                            style={{
                                // 与 :root 里的 --accent 保持同一饱和度，预览才不会比实际更刺眼
                                background: `hsl(${preset.hue} 72% 52%)`,
                                boxShadow: active
                                    ? `0 0 0 2px var(--bg), 0 0 0 3.5px hsl(${preset.hue} 72% 52%)`
                                    : "inset 0 1px 0 rgba(255,255,255,0.25)",
                            }}
                        >
                            {active && <CheckIcon size={11} strokeWidth={3.5} className="text-white" />}
                        </button>
                    );
                })}
            </div>

            <p className="mt-2.5 text-[11px] text-fg-mute">
                {t("settings.themeHint", {
                    mode: resolvedMode === "dark" ? t("settings.theme.dark") : t("settings.theme.light"),
                })}
            </p>
        </section>
    );
}
