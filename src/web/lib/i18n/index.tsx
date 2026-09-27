"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, dictionaries, LOCALE_COOKIE, type Locale, type TranslationKey } from "./dictionaries";

export { dictionaries, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./dictionaries";
export type { Locale, TranslationKey };

type Params = Record<string, string | number>;

interface I18nValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: TranslationKey, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, params?: Params): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) =>
        key in params ? String(params[key]) : `{${key}}`,
    );
}

export function I18nProvider({
    initialLocale = DEFAULT_LOCALE,
    children,
}: {
    initialLocale?: Locale;
    children: ReactNode;
}) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        // 写 cookie，刷新后服务端能读到首屏语言
        if (typeof document !== "undefined") {
            document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
    }, []);

    const t = useCallback(
        (key: TranslationKey, params?: Params) => {
            const dict = dictionaries[locale] as Record<string, string>;
            const fallback = dictionaries[DEFAULT_LOCALE] as Record<string, string>;
            return interpolate(dict[key] ?? fallback[key] ?? key, params);
        },
        [locale],
    );

    const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("useI18n must be used within I18nProvider");
    return ctx;
}
