"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/web/hooks/use-mounted";
import { useUi } from "@/web/stores/ui-store";
import { zLayers } from "./z-layers";

/** 退场动画时长，与 CSS 里的 --dur-fast 对齐 */
const EXIT_MS = 150;

/**
 * 全局轻提示：portal 到 body，固定底部居中，几秒后自动消失，点击可立即关闭。
 * 层级与弹窗一致，不受父级 `backdrop-filter` 形成的层叠上下文影响。
 *
 * 退场：store 里 toast 变成 null 时，这里先播 150ms 淡出再卸载，
 * 避免「突然消失」。用当前文案做 key，连续两条不同提示会重新播入场动画。
 */
export function ToastViewport() {
    const mounted = useMounted();
    const { toast, dismissToast } = useUi();

    // 记住最后一条文案：toast 变 null 后仍要显示它来完成退场
    const [shown, setShown] = useState<string | null>(toast);
    const [closing, setClosing] = useState(false);
    const lastRef = useRef<string | null>(toast);

    useEffect(() => {
        if (toast) {
            lastRef.current = toast;
            setShown(toast);
            setClosing(false);
            return;
        }
        // toast 被清空 → 播退场
        setClosing(true);
        const timer = setTimeout(() => {
            setShown(null);
            setClosing(false);
        }, EXIT_MS);
        return () => clearTimeout(timer);
    }, [toast]);

    if (!mounted || !shown) return null;

    return createPortal(
        <div
            className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
            style={{ zIndex: zLayers.overlay }}
        >
            <div
                key={shown}
                role="status"
                aria-live="polite"
                onClick={dismissToast}
                className="surface-raised pointer-events-auto max-w-[90vw] cursor-pointer px-4 py-2.5 text-sm font-bold text-fg"
                style={{
                    animation: closing
                        ? `pop-out ${EXIT_MS}ms var(--ease-exit) forwards`
                        : "pop-in var(--dur-base) var(--ease-enter)",
                }}
            >
                {shown}
            </div>
        </div>,
        document.body,
    );
}
