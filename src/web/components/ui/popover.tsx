"use client";

import { useEffect, useState, type RefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/web/hooks/use-mounted";
import { cn } from "@/web/lib/cn";
import { zLayers } from "./z-layers";

interface PopoverProps {
    open: boolean;
    /** 定位锚点（通常是输入框的外层容器） */
    anchorRef: RefObject<HTMLElement | null>;
    className?: string;
    offset?: number;
    /** 固定宽度；不传则与锚点等宽 */
    width?: number;
    /** 水平对齐方式，默认 left（与锚点左对齐）；right 表示与锚点右对齐 */
    align?: "left" | "right";
    children: ReactNode;
}

/**
 * 锚定浮层：portal 到 body 并按锚点位置定位，
 * 避免被父级 `overflow-y-auto` 裁剪或被后续卡片盖住。
 */
export function Popover({ open, anchorRef, className, offset = 6, width, align = "left", children }: PopoverProps) {
    const mounted = useMounted();
    const [rect, setRect] = useState<DOMRect | null>(null);

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

    if (!mounted || !open || !rect) return null;

    const menuWidth = width ?? rect.width;

    return createPortal(
        <div
            className={cn(className)}
            style={{
                position: "fixed",
                top: rect.bottom + offset,
                left: align === "right" ? rect.right - menuWidth : rect.left,
                width: menuWidth,
                zIndex: zLayers.overlay,
            }}
        >
            {children}
        </div>,
        document.body,
    );
}
