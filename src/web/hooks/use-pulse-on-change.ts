"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 布尔值「变为 true」时返回一个只生效一次的动画标记。
 *
 * 用途：点赞心跳这类「只在正向操作时播一次」的动效。
 * 取消点赞、或者首次渲染时布尔本来就是 true，都不该触发，
 * 所以只在 false → true 的切换上打标记，播完自动清掉，
 * 保证同一元素重复触发时能重新播放动画（key 变化）。
 *
 * 返回的 `animationKey` 每次触发自增：把它挂到元素的 key 上，
 * 动画会重新开始，而不是被 React 复用旧节点跳过。
 */
export function usePulseOnChange(active: boolean): number {
    const previous = useRef(active);
    const [animationKey, setAnimationKey] = useState(0);

    useEffect(() => {
        // 只在「由假变真」时播放
        if (active && !previous.current) {
            setAnimationKey((key) => key + 1);
        }
        previous.current = active;
    }, [active]);

    return animationKey;
}
