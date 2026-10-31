/**
 * 前端文案字典入口。
 *
 * 具体文案拆到各语言文件里，这里只负责组装与导出：
 * - `zh.ts` / `en.ts` / `ja.ts`：各语言的实际文案，key 用扁平命名，支持 `{name}` 占位符插值
 * - 本文件：汇总成 `dictionaries`，并导出语言类型与默认值
 *
 * 新增语言：加一份 `xx.ts`，然后在下面 `dictionaries` 里补一行，
 * 再把 `xx` 加到 `LOCALES` 里即可（`Locale` 会自动跟着扩展，
 * `isLocale` 也基于 `LOCALES`，不用另改）。
 *
 * 为什么拆开：原来中英文都堆在一个文件里，接近 500 行，
 * 改文案时要在同一个文件里上下翻找，且多种语言混在一起容易漏改。
 * 拆开后每种语言一个文件，key 顺序保持一一对应，对照修改方便很多。
 */
import { en } from "./en";
import { ja } from "./ja";
import { zh } from "./zh";

export const dictionaries = {
    zh,
    en,
    ja,
} as const;

export type Locale = keyof typeof dictionaries;
export type TranslationKey = keyof (typeof dictionaries)["zh"];

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "lightap_lang";

/** 语言选项的展示顺序：中文 → English → 日本語 */
export const LOCALES: readonly Locale[] = ["zh", "en", "ja"];

export function isLocale(value: string | null | undefined): value is Locale {
    return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * 取某个语言的站点标题与描述。
 *
 * 服务端（`generateMetadata`）和客户端（切换语言时同步 `document.title`）
 * 都走这里，保证两边文案永远一致，不用在两处维护同一份字符串。
 */
export function getSiteMeta(locale: Locale): { title: string; description: string } {
    const dict = dictionaries[locale] as Record<string, string>;
    const fallback = dictionaries[DEFAULT_LOCALE] as Record<string, string>;
    return {
        title: dict["meta.title"] ?? fallback["meta.title"],
        description: dict["meta.description"] ?? fallback["meta.description"],
    };
}

/** 界面语言 → `<html lang>` 用的 BCP-47 标签 */
export const HTML_LANG: Record<Locale, string> = {
    zh: "zh-CN",
    en: "en",
    ja: "ja",
};
