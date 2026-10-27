"use client";

import { cn } from "@/web/lib/cn";

/**
 * 未读数角标：数字变化时轻轻弹一下，让「有新通知」更容易被察觉。
 *
 * 用数值做 key，数字一变就重新挂载并重播动画；
 * 99+ 的上限判断收在组件里，调用方只传原始数字。
 */
export function CountBadge({
    count,
    className,
}: {
    count: number;
    className?: string;
}) {
    if (count <= 0) return null;

    return (
        <span
            key={count}
            className={cn(
                "count-bump rounded-full bg-brand-deep text-[10px] font-bold tabular-nums text-white",
                className,
            )}
        >
            {count > 99 ? "99+" : count}
        </span>
    );
}
