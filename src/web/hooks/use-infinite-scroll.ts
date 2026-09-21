"use client";

import { useEffect, useRef } from "react";

/**
 * 无限滚动：把返回的 ref 挂到底部哨兵元素上，
 * 当它进入视口（含 200px 预加载）时触发 onLoadMore。
 *
 * enabled 为 false 时不监听；加载完成后 enabled 重新变 true 会重新观察，
 * 若哨兵仍在视口内会继续触发，从而自动填满一屏。
 */
export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = sentinelRef.current;
        if (!element || !enabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
            },
            { rootMargin: "200px" },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [onLoadMore, enabled]);

    return sentinelRef;
}
