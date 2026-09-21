"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/web/lib/format";

export interface RelativeTimeProps {
    iso: string;
    className?: string;
}

/**
 * 相对时间只在客户端计算（服务端与首帧渲染空字符串），
 * 避免 Date.now() 在 SSR / hydration 之间产生不一致。
 */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
    const [label, setLabel] = useState("");

    useEffect(() => {
        const update = () => setLabel(timeAgo(iso));
        update();
        const timer = setInterval(update, 60_000);
        return () => clearInterval(timer);
    }, [iso]);

    return (
        <span className={className} suppressHydrationWarning>
            {label}
        </span>
    );
}
