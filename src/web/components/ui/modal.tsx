"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

/** 退场动画时长，需与 CSS 里的 --dur-fast 对齐 */
const EXIT_MS = 150;

/**
 * 全局弹窗外壳：portal 到 body，层级固定在最上层，
 * 不再受父级 `backdrop-filter` / `overflow` 影响；统一处理 Escape 与滚动锁定。
 *
 * 关闭时先播 150ms 退场动画再卸载，避免面板「瞬间消失」；
 * 退场期间外层已 `pointer-events: none`，不会挡住用户的下一次点击。
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

    // 关闭后保留一小段时间用于播退场动画
    const [visible, setVisible] = useState(open);
    const [closing, setClosing] = useState(false);

    useEscapeKey(onClose, open);

    useEffect(() => {
        if (open) {
            setVisible(true);
            setClosing(false);
            return;
        }
        // 关闭：已不可见就直接跳过，否则播完退场再卸载
        setClosing(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setClosing(false);
        }, EXIT_MS);
        return () => clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    if (!mounted || !visible) return null;

    const isBackdrop = (target: EventTarget | null, currentTarget: EventTarget | null) =>
        target === currentTarget;

    return createPortal(
        <div
            className={cn(
                "fixed inset-0 flex bg-black/25 backdrop-blur-[2px]",
                closing && "pointer-events-none",
                alignClassName,
            )}
            style={{
                zIndex: zLayers.overlay,
                // 遮罩与面板同步淡出，避免面板还在淡出、背景突然变亮
                animation: closing ? `fade-out ${EXIT_MS}ms var(--ease-exit) forwards` : undefined,
            }}
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
            <div
                className={panelClassName}
                style={
                    closing
                        ? { animation: `pop-out ${EXIT_MS}ms var(--ease-exit) forwards` }
                        : animation
                          ? { animation }
                          : undefined
                }
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
