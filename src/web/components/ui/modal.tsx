"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/web/hooks/use-escape-key";
import { useMounted } from "@/web/hooks/use-mounted";
import { cn } from "@/web/lib/cn";
import { zLayers } from "./z-layers";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    /** 无障碍名称 */
    label: string;
    /** 外层定位样式（决定居中 / 底部弹出 / 顶部弹出） */
    alignClassName: string;
    /** 玻璃面板样式（尺寸、圆角、内边距） */
    panelClassName: string;
    /** 面板入场动画，传 null 关闭 */
    animation?: string | null;
    children: ReactNode;
}

/**
 * 全局弹窗外壳：portal 到 body，层级固定在最上层，
 * 不再受父级 `backdrop-filter` / `overflow` 影响；统一处理 Escape 与滚动锁定。
 *
 * 点击遮罩关闭采用“按下与松开都在遮罩上”才触发的判定：
 * 从面板内按下、在遮罩上松开不会误关（click 的目标会是两者公共祖先）。
 */
export function Modal({
    open,
    onClose,
    label,
    alignClassName,
    panelClassName,
    animation = "drop-in .32s cubic-bezier(.34,1.4,.64,1)",
    children,
}: ModalProps) {
    const mounted = useMounted();
    const pressedOnBackdrop = useRef(false);
    useEscapeKey(onClose, open);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    if (!mounted || !open) return null;

    const isBackdrop = (target: EventTarget | null, currentTarget: EventTarget | null) =>
        target === currentTarget;

    return createPortal(
        <div
            className={cn("fixed inset-0 flex bg-brand-ink/20 backdrop-blur-sm", alignClassName)}
            style={{ zIndex: zLayers.overlay }}
            onPointerDown={(e) => {
                // 只认左键，且必须直接按在遮罩上
                pressedOnBackdrop.current = e.button === 0 && isBackdrop(e.target, e.currentTarget);
            }}
            onPointerUp={(e) => {
                const shouldClose =
                    pressedOnBackdrop.current && e.button === 0 && isBackdrop(e.target, e.currentTarget);
                pressedOnBackdrop.current = false;
                if (shouldClose) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={label}
        >
            <div className={panelClassName} style={animation ? { animation } : undefined}>
                {children}
            </div>
        </div>,
        document.body,
    );
}
