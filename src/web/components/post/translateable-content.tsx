"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { streamTranslate } from "@/web/lib/api/translate";

/** 当前显示什么 */
type ViewMode = "original" | "translated";

/**
 * 译文缓存：`locale + 原文` → 译文。
 *
 * 放在模块级而不是组件里，有两个原因：
 * 1. **跨组件共享**：同一条帖子可能同时出现在时间线和详情页，翻译一次就够
 * 2. **跨语言切换**：用户切回原语言时不用重新请求
 *
 * 用 Map 的插入顺序做简易 LRU：超过上限就丢最早的一条，
 * 避免长时间浏览后内存无限增长。
 */
const CACHE_LIMIT = 200;
const translationCache = new Map<string, string>();

function cacheKey(locale: string, content: string): string {
    return `${locale}\u0000${content}`;
}

function readCache(locale: string, content: string): string | undefined {
    return translationCache.get(cacheKey(locale, content));
}

function writeCache(locale: string, content: string, text: string): void {
    const key = cacheKey(locale, content);
    // 先删再插：保证被更新的条目移到末尾（最新的不会被优先淘汰）
    translationCache.delete(key);
    translationCache.set(key, text);

    if (translationCache.size > CACHE_LIMIT) {
        const oldest = translationCache.keys().next().value;
        if (oldest !== undefined) translationCache.delete(oldest);
    }
}

interface TranslateableContentProps {
    /** 原文 */
    content: string;
    /** 渲染正文的回调（原样交给 PostContent，保留话题/提及/链接样式） */
    render: (text: string) => React.ReactNode;
    /** 点击交互时阻止冒泡（避免触发整卡跳转） */
    onInteract?: (e: React.MouseEvent) => void;
}

/**
 * 可翻译的正文。
 *
 * 交互设计：
 * - 默认显示**原文**，不主动翻译（省配额，也尊重用户当前语言）
 * - 点「翻译」后**流式**显示译文（边收边出，不用等整段生成）
 * - 有译文后可以切回原文，再点切回译文（走缓存，不重新请求）
 * - 翻译途中点「显示原文」会**真正中止请求**，半成品丢弃
 *
 * 语言切换：如果用户当前正在看译文，切换界面语言后会自动翻译成新语言；
 * 正在看原文时则不动（尊重用户此刻的选择）。
 */
export function TranslateableContent({ content, render, onInteract }: TranslateableContentProps) {
    const { t, locale } = useI18n();

    const [mode, setMode] = useState<ViewMode>("original");
    /** 当前显示的译文文本 */
    const [translated, setTranslated] = useState("");
    /** 上面这段译文对应的语言，用于判断是否要重译 */
    const [translatedLocale, setTranslatedLocale] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 中止当前流
    const abortRef = useRef<(() => void) | null>(null);
    // 请求代次：每次发起/中止都自增，回调据此判断自己是否已过期
    const generationRef = useRef(0);
    // 用 ref 读当前 mode，避免把 mode 放进 effect 依赖里造成额外触发
    const modeRef = useRef<ViewMode>("original");
    modeRef.current = mode;

    /**
     * 中止当前请求并让它的回调失效。
     *
     * 只调 abort 还不够：已排队的回调仍可能执行一次，
     * 所以用 generation 代次做闸门，过期回调直接 return。
     */
    const cancelActive = useCallback(() => {
        generationRef.current += 1;
        abortRef.current?.();
        abortRef.current = null;
        setLoading(false);
    }, []);

    // 卸载时中断请求，避免组件消失后还在耗配额
    useEffect(() => cancelActive, [cancelActive]);

    /**
     * 取指定语言的译文：命中缓存直接返回，否则流式请求。
     *
     * 流式过程中每收到一段就更新 UI；**正常完成**才写入缓存。
     * 被中止时（切换语言 / 用户点「显示原文」）不写缓存。
     */
    const ensureTranslation = useCallback(
        (targetLocale: string) => {
            const cached = readCache(targetLocale, content);
            if (cached) {
                cancelActive();
                setTranslated(cached);
                setTranslatedLocale(targetLocale);
                setError(null);
                return;
            }

            cancelActive();
            // 本代次的回调才允许改状态
            const generation = generationRef.current;

            setTranslated("");
            setTranslatedLocale(targetLocale);
            setError(null);
            setLoading(true);

            let acc = "";
            abortRef.current = streamTranslate(
                { text: content, to: targetLocale },
                {
                    onDelta: (delta) => {
                        if (generationRef.current !== generation) return;
                        acc += delta;
                        setTranslated(acc);
                    },
                    // 服务端在结束时可能要求整体替换（清理引号/前缀）
                    onReplace: (text) => {
                        if (generationRef.current !== generation) return;
                        acc = text;
                        setTranslated(text);
                    },
                    onDone: () => {
                        if (generationRef.current !== generation) return;
                        setLoading(false);
                        if (acc) writeCache(targetLocale, content, acc);
                    },
                    onError: (message) => {
                        if (generationRef.current !== generation) return;
                        // 失败就退回原文：没有「重试」按钮了，
                        // 用户再点一次「翻译」即可重新请求
                        setLoading(false);
                        setError(message);
                        setMode("original");
                    },
                },
            );
        },
        [content, cancelActive],
    );

    // 内容变了（同一条卡片复用于不同帖子时）重置状态
    useEffect(() => {
        cancelActive();
        setMode("original");
        setTranslated("");
        setTranslatedLocale(null);
        setError(null);
    }, [content, cancelActive]);

    // 界面语言变了：只在「正在看译文」时重译，看原文时不动
    const prevLocale = useRef(locale);
    useEffect(() => {
        if (prevLocale.current === locale) return;
        prevLocale.current = locale;

        if (modeRef.current !== "translated") return;
        ensureTranslation(locale);
    }, [locale, ensureTranslation]);

    const onToggle = useCallback(
        (e: React.MouseEvent) => {
            onInteract?.(e);
            e.stopPropagation();

            if (modeRef.current === "translated") {
                // 正在看译文（可能还在流式生成中）→ 切回原文。
                // 必须真正中止请求：用户已经不想看了，继续生成
                // 既浪费配额也浪费流量。半成品直接丢弃（不写缓存）；
                // 已完成的译文早写进缓存了，再点「翻译」仍然秒出。
                cancelActive();
                setMode("original");
                setTranslated("");
                setTranslatedLocale(null);
                return;
            }

            setMode("translated");
            ensureTranslation(locale);
        },
        [cancelActive, ensureTranslation, locale, onInteract],
    );

    const showingTranslation = mode === "translated";
    // 只有「已有当前语言的译文」才算可切换，避免语言刚切换时误显示旧语言的译文
    const hasCurrentTranslation = Boolean(translated) && translatedLocale === locale && !error;

    const label = showingTranslation
        ? t("translate.showOriginal")
        : hasCurrentTranslation
          ? t("translate.showTranslation")
          : t("translate.action");

    return (
        <div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">
                {showingTranslation ? (
                    <>
                        {translated ? render(translated) : null}
                        {/* 流式进行中：光标提示还在生成 */}
                        {loading && (
                            <span
                                aria-hidden="true"
                                className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-brand align-middle"
                            />
                        )}
                        {/* 还没收到任何内容且没报错：占位提示 */}
                        {!translated && !error && (
                            <span className="text-fg-mute">{t("translate.translating")}</span>
                        )}
                    </>
                ) : (
                    render(content)
                )}
            </p>

            {error && (
                <p className="mt-1 text-[11px] text-sakura-deep" role="alert">
                    {t("translate.failed")}
                </p>
            )}

            <div className="mt-1.5 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={label}
                    className={cn(
                        "press-sm inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
                        showingTranslation || hasCurrentTranslation
                            ? "text-brand-deep hover:bg-brand/10"
                            : "text-fg-mute hover:bg-overlay hover:text-brand-deep",
                    )}
                >
                    <TranslateGlyph />
                    {label}
                </button>
            </div>
        </div>
    );
}

/** 翻译图标（两个 A 与箭头，示意语言切换） */
function TranslateGlyph() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
        </svg>
    );
}
