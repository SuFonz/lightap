"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/web/hooks/use-mounted";
import { cn } from "@/web/lib/cn";
import { zLayers } from "@/web/components/ui/z-layers";
import type { PostAttachment } from "@/web/types";

/**
 * 图片灯箱：在页面内查看大图，支持左右切换。
 *
 * 为什么自己做一个而不是直接用 `<a target="_blank">`：
 * 站内浏览体验更好（不跳走、不丢上下文），也方便多图连看。
 * 视频/音频仍然用浏览器自带控件，不在这里处理。
 *
 * 交互：
 * - ← → 或 A / D 切换上一张 / 下一张
 * - Esc 关闭
 * - 点击遮罩关闭（按下与松开都在遮罩上才算，避免拖动误关）
 * - 左右滑动切换（触屏）
 *
 * 性能：只渲染当前这张的大图 + 预加载相邻两张，避免一次拉取全部原图。
 */
export function Lightbox({
    images,
    index,
    onClose,
    onChange,
}: {
    images: PostAttachment[];
    /** 当前索引；null 表示关闭 */
    index: number | null;
    onClose: () => void;
    onChange: (next: number) => void;
}) {
    const mounted = useMounted();
    const [loaded, setLoaded] = useState(false);
    // 切换方向：+1 表示往右翻（新图从右侧进），-1 表示往左翻
    // 用于给入场动画选边，让滑动方向跟操作方向一致
    const [direction, setDirection] = useState<1 | -1>(1);
    const pressedOnBackdrop = useRef(false);
    // 触屏滑动的起点
    const touchStartX = useRef<number | null>(null);

    const open = index !== null && index >= 0 && index < images.length;
    const current = open ? images[index] : null;

    // 切换图片时重置加载状态，避免上一张的 loaded 状态串到下一张
    useEffect(() => {
        setLoaded(false);
    }, [index]);

    const go = useCallback(
        (delta: number) => {
            if (index === null) return;
            // 循环切换：第一张往前是最后一张
            const next = (index + delta + images.length) % images.length;
            // 记下方向，供动画选边
            setDirection(delta > 0 ? 1 : -1);
            onChange(next);
        },
        [index, images.length, onChange],
    );

    /** 点指示器直接跳转：按目标位置与当前的相对关系决定动画方向 */
    const jumpTo = useCallback(
        (next: number) => {
            if (index === null || next === index) return;
            setDirection(next > index ? 1 : -1);
            onChange(next);
        },
        [index, onChange],
    );

    // 键盘操作
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                e.preventDefault();
                go(-1);
                return;
            }
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                e.preventDefault();
                go(1);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose, go]);

    // 打开时锁滚动，关闭后恢复
    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    // 预加载相邻图片：切换时不用等
    useEffect(() => {
        if (!open || index === null || images.length < 2) return;
        for (const delta of [1, -1]) {
            const target = images[(index + delta + images.length) % images.length];
            if (!target?.url) continue;
            const img = new Image();
            img.src = target.url;
        }
    }, [open, index, images]);

    if (!mounted || !open || !current) return null;

    const total = images.length;
    const hasMultiple = total > 1;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm"
            style={{ zIndex: zLayers.overlay + 10, animation: "pop-in var(--dur-fast) var(--ease-enter)" }}
            role="dialog"
            aria-modal="true"
            aria-label={current.name || `图片 ${index + 1} / ${total}`}
            // portal 到 body，但 React 事件仍会沿组件树冒泡到帖子卡片，
            // 不拦住的话点一下灯箱就会跳进帖子详情页
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
                e.stopPropagation();
                // 只有直接按在遮罩（而不是图片/按钮）上才算点击遮罩
                pressedOnBackdrop.current = e.button === 0 && e.target === e.currentTarget;
            }}
            onPointerUp={(e) => {
                e.stopPropagation();
                const shouldClose = pressedOnBackdrop.current && e.target === e.currentTarget;
                pressedOnBackdrop.current = false;
                if (shouldClose) onClose();
            }}
            onTouchStart={(e) => {
                touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
                const start = touchStartX.current;
                touchStartX.current = null;
                if (start === null || !hasMultiple) return;
                const end = e.changedTouches[0]?.clientX ?? start;
                const dx = end - start;
                // 滑动超过 50px 才切换，避免轻触误判
                if (Math.abs(dx) < 50) return;
                go(dx > 0 ? -1 : 1);
            }}
        >
            {/* 顶部工具条：计数 + 关闭 */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-white/90">
                    {index + 1} / {total}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="关闭"
                    className="press-sm flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                    <CloseGlyph />
                </button>
            </div>

            {/* 上一张 */}
            {hasMultiple && (
                <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="上一张"
                    className="press-sm absolute left-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:left-4"
                >
                    <ArrowGlyph direction="left" />
                </button>
            )}

            {/* 图片本体：contain 保证完整可见，不裁切 */}
            <div className="pointer-events-none flex max-h-[86vh] max-w-[92vw] items-center justify-center">
                {!loaded && (
                    <span className="absolute h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" aria-hidden="true" />
                )}
                {/*
                  key 用「url + 索引」：同一张图重复出现时也能重新触发动画。
                  方向性入场：往右翻时新图从右侧滑入，往左翻时从左侧滑入。
                  图片加载完成前不播动画（否则会先看到一张空白图在滑）。
                */}
                <img
                    key={`${current.url}-${index}`}
                    src={current.url}
                    alt={current.name ?? ""}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    onLoad={() => setLoaded(true)}
                    onError={() => setLoaded(true)}
                    className={cn(
                        "pointer-events-auto max-h-[86vh] max-w-[92vw] rounded-lg object-contain transition-opacity duration-200",
                        loaded
                            ? cn("opacity-100", direction > 0 ? "slide-from-right" : "slide-from-left")
                            : "opacity-0",
                    )}
                />
            </div>

            {/* 下一张 */}
            {hasMultiple && (
                <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="下一张"
                    className="press-sm absolute right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:right-4"
                >
                    <ArrowGlyph direction="right" />
                </button>
            )}

            {/* 底部：图片描述 + 缩略图指示器 */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-4">
                {current.name && (
                    <p className="max-w-[80vw] truncate text-center text-[13px] text-white/80">{current.name}</p>
                )}
                {hasMultiple && (
                    <div className="flex items-center gap-1.5" role="tablist" aria-label="选择图片">
                        {images.map((img, i) => (
                            <button
                                key={`${img.url}-${i}`}
                                type="button"
                                onClick={() => jumpTo(i)}
                                aria-label={`第 ${i + 1} 张`}
                                aria-selected={i === index}
                                role="tab"
                                className={cn(
                                    "h-1.5 cursor-pointer rounded-full transition-all duration-200",
                                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70",
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}

function CloseGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function ArrowGlyph({ direction }: { direction: "left" | "right" }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
        </svg>
    );
}
