"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicConfig } from "@/web/hooks/use-public-config";

/** Turnstile 全局脚本地址 */
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Turnstile 注入到 window 上的对象 */
interface TurnstileApi {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            theme?: "light" | "dark" | "auto";
            callback?: (token: string) => void;
            "error-callback"?: () => void;
            "expired-callback"?: () => void;
        },
    ) => string | undefined;
    remove: (widgetId: string) => void;
    reset: (widgetId: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

interface BotCheckWidgetProps {
    /**
     * token 变化回调。
     * 拿到 token 表示用户通过了挑战；`null` 表示失效 / 出错 / 尚未完成。
     */
    onTokenChange: (token: string | null) => void;
    /**
     * 重置信号：每次变化都让 widget 重新挑战。
     *
     * 为什么需要：Turnstile 的 token **只能用一次**（服务端校验后会拒绝重复使用，
     * 返回 timeout-or-duplicate）。所以提交失败（比如用户名被占用）后，
     * 必须重新拿一个新 token，否则第二次提交必然 403。
     * 父组件在每次提交结束后把这个值 +1。
     */
    resetSignal?: number;
}

/**
 * 机器人验证 widget（Cloudflare Turnstile）。
 *
 * **可选功能**：只有后端下发了 `siteKey`（即环境变量配了 TURNSTILE_SITE_KEY）
 * 才会渲染。没配置时组件返回 null，注册表单与以前完全一致。
 *
 * 主题跟随站点的 `data-theme`，避免深色页面里嵌一块白框。
 */
export function BotCheckWidget({ onTokenChange, resetSignal = 0 }: BotCheckWidgetProps) {
    const config = usePublicConfig();
    const siteKey = config?.botDetection?.siteKey ?? null;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptReady, setScriptReady] = useState(false);
    const [failed, setFailed] = useState(false);

    // 回调放 ref 里：避免父组件每次渲染都给新函数导致 widget 反复重建
    const onChangeRef = useRef(onTokenChange);
    onChangeRef.current = onTokenChange;

    // 加载 Turnstile 脚本（全局只加载一次）
    useEffect(() => {
        if (!siteKey) return;
        if (window.turnstile) {
            setScriptReady(true);
            return;
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SCRIPT}"]`);
        if (existing) {
            existing.addEventListener("load", () => setScriptReady(true), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.defer = true;
        script.addEventListener("load", () => setScriptReady(true), { once: true });
        script.addEventListener("error", () => setFailed(true), { once: true });
        document.head.appendChild(script);
    }, [siteKey]);

    // 渲染 widget
    useEffect(() => {
        if (!siteKey || !scriptReady || !window.turnstile || !containerRef.current) return;
        if (widgetIdRef.current) return; // 已渲染过

        // 主题跟随站点
        const isDark = document.documentElement.dataset.theme === "dark";

        const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: isDark ? "dark" : "light",
            callback: (token) => onChangeRef.current(token),
            "error-callback": () => {
                onChangeRef.current(null);
                setFailed(true);
            },
            "expired-callback": () => onChangeRef.current(null),
        });
        widgetIdRef.current = id ?? null;

        return () => {
            // 卸载时清掉 widget，否则重新打开弹窗会叠出多个
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // widget 已被移除时忽略
                }
            }
            widgetIdRef.current = null;
        };
    }, [siteKey, scriptReady]);

    // 重置：每次 resetSignal 变化都让 widget 重新挑战，拿到新 token。
    //
    // 必须在渲染之后、且跳过初始那次（resetSignal=0 时 widget 刚渲染，不需要重置）。
    const lastResetRef = useRef(resetSignal);
    useEffect(() => {
        if (resetSignal === lastResetRef.current) return;
        lastResetRef.current = resetSignal;

        // 先清掉父组件持有的旧 token：新挑战还没完成前它是无效的
        onChangeRef.current(null);

        if (!widgetIdRef.current || !window.turnstile) return;
        try {
            window.turnstile.reset(widgetIdRef.current);
        } catch {
            // widget 已被移除时忽略
        }
    }, [resetSignal]);

    // 未配置：完全不渲染
    if (!siteKey) return null;

    if (failed) {
        return (
            <p className="rounded-[10px] bg-overlay px-3 py-2 text-[11px] text-fg-mute">
                人机验证加载失败，请刷新页面重试。
            </p>
        );
    }

    return <div ref={containerRef} className="flex justify-center" aria-label="人机验证" />;
}
