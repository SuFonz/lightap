"use client";

import { useEffect, useState, type RefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/web/hooks/use-mounted";
import { cn } from "@/web/lib/cn";
import { zLayers } from "./z-layers";

interface PopoverProps {
    open: boolean;
    /** 定位锚点 */
    anchorRef: RefObject<HTMLElement | null>;
    className?: string;
    offset?: number;
    /** 固定宽度；不传则与锚点等宽 */
    width?: number;
    /** 水平对齐：left 与锚点左对齐；right 与锚点右对齐 */
    align?: "left" | "right";
    /**
     * 展开方向：
     * - down 向下（默认）
     * - up   向上（底边贴锚点顶边）
     * - right 向右展开（锚点右侧，垂直居中对齐锚点）
     *
     * 底部工具条这种贴着屏幕下沿的按钮用 up 会盖住上方内容，
     * 用 right 更合适：菜单从图标右侧展开，不遮挡任何东西。
     */
    direction?: "down" | "up" | "right";
    /** 提供后：点击浮层之外 / 按 Esc 会自动关闭 */
    onClose?: () => void;
    children: ReactNode;
}

/**
 * 锚定浮层：portal 到 body 并按锚点位置定位，
 * 避免被父级 `overflow-y-auto` 裁剪或被后续卡片盖住。
 *
 * 传了 `onClose` 时：
 * - 点击浮层与锚点之外的任何地方 → 关闭
 * - 按 Esc → 关闭
 *
 * 用 pointerdown 而不是 click：连"在别处按下鼠标"也能关掉浮层。
 */
export function Popover({
    open,
    anchorRef,
    className,
    offset = 6,
    width,
    align = "left",
    direction = "down",
    onClose,
    children,
}: PopoverProps) {
    const mounted = useMounted();
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [panelRef, setPanelRef] = useState<HTMLDivElement | null>(null);

    // 跟随锚点定位
    useEffect(() => {
        if (!open) return;
        const update = () => {
            const element = anchorRef.current;
            if (element) setRect(element.getBoundingClientRect());
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, anchorRef]);

    // 点击外部 / Esc 关闭
    useEffect(() => {
        if (!open || !onClose) return;

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            // 点在浮层内部 → 不关
            if (panelRef?.contains(target)) return;
            // 点在锚点上 → 交给锚点自己的 toggle，避免「关掉又被打开」
            if (anchorRef.current?.contains(target)) return;
            onClose();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        // capture：即使子元素 stopPropagation 也能收到
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose, panelRef, anchorRef]);

    if (!mounted || !open || !rect) return null;

    const menuWidth = width ?? rect.width;

    // 三种方向的定位
    const position =
        direction === "right"
            ? {
                  // 从锚点右侧展开，垂直居中于锚点
                  left: rect.right + offset,
                  top: rect.top + rect.height / 2,
                  transform: "translateY(-50%)",
              }
            : direction === "up"
              ? {
                  bottom: window.innerHeight - rect.top + offset,
                  left: align === "right" ? rect.right - menuWidth : rect.left,
                }
              : {
                  top: rect.bottom + offset,
                  left: align === "right" ? rect.right - menuWidth : rect.left,
                };

    return createPortal(
        <div
            ref={setPanelRef}
            className={cn("fixed", className)}
            style={{
                ...position,
                width: menuWidth,
                zIndex: zLayers.overlay,
                animation: "pop-in 0.16s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
        >
            {children}
        </div>,
        document.body,
    );
}
