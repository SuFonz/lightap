"use client";

import { useEffect, useRef } from "react";

/**
 * 返回一个判断函数：某个 id 是否是「自上次提交以来新出现的」。
 *
 * 用途：列表插入新项时只给新项播入场动画，已有项保持静止。
 * 如果给每一项都加 animation，React 复用节点会导致整列重播动画，
 * 滚动时也会持续重排，影响时间线流畅度。
 *
 * 关键点：
 * - **首次填充不播动画**。时间线首屏是「空 → N 条」的一次性填充，
 *   这时整列播入场会很吵；只有列表已经有内容、又插入新项时才值得提示。
 * - 已见集合在 effect 提交后更新，不在渲染期改 ref，
 *   否则并发渲染 / StrictMode 下会误判「新项」。
 * - effect 依赖用 id 拼接后的签名，避免调用方每次 `ids.map(...)`
 *   产生新数组导致 effect 每次重跑。
 */
export function useNewItems<T extends string | number>(ids: readonly T[]): (id: T) => boolean {
    const seenRef = useRef<Set<T> | null>(null);
    // 本次渲染算出的「新项」，渲染期只读这里
    const freshRef = useRef<Set<T>>(new Set());

    if (seenRef.current === null) {
        // 首帧：记录当前内容，全部视为「不是新的」
        freshRef.current = new Set();
    } else if (seenRef.current.size === 0) {
        // 首次填充（空列表 → 有内容）：也视为不是新的，避免首屏整列抖动
        freshRef.current = new Set();
    } else {
        const seen = seenRef.current;
        const fresh = new Set<T>();
        for (const id of ids) {
            if (!seen.has(id)) fresh.add(id);
        }
        freshRef.current = fresh;
    }

    // 用 join 做依赖签名：本项目里 id 是 uuid 或数字字符串，不含 "|"
    const signature = ids.join("|");

    useEffect(() => {
        seenRef.current = new Set(ids);
        // ids 每次渲染都是新引用，用 signature 代替它作为依赖
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    return (id: T) => freshRef.current.has(id);
}
