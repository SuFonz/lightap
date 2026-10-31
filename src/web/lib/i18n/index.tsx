"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, dictionaries, getSiteMeta, HTML_LANG, LOCALE_COOKIE, type Locale, type TranslationKey } from "./dictionaries";

export { dictionaries, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, getSiteMeta } from "./dictionaries";
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

    /**
     * 切换语言时同步页面标题与 `<html lang>`。
     *
     * 为什么要在客户端改：`generateMetadata` 只在服务端跑，改语言不会重新请求，
     * 所以浏览器标签页会一直停在上一种语言的标题。
     * 首次挂载时也跑一次，但值和服务端输出一致，不会有多余变化。
     *
     * 只用 `document.title` 而不调 `router.refresh()`：后者会让整页重新拉数据，
     * 为了改一个标题不值得。
     */
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.title = getSiteMeta(locale).title;
        document.documentElement.lang = HTML_LANG[locale];
    }, [locale]);

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
