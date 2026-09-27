"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/web/lib/i18n";

export interface RelativeTimeProps {
    iso: string;
    className?: string;
}

/**
 * 相对时间只在客户端计算（服务端与首帧渲染空字符串），
 * 避免 Date.now() 在 SSR / hydration 之间产生不一致。
 */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
    const { t } = useI18n();
    const [label, setLabel] = useState("");

    useEffect(() => {
        const update = () => {
            const time = new Date(iso).getTime();
            if (Number.isNaN(time)) {
                setLabel("");
                return;
            }
            const diff = Date.now() - time;
            if (diff < 60_000) {
                setLabel(t("time.justNow"));
                return;
            }
            const minutes = Math.floor(diff / 60_000);
            if (minutes < 60) {
                setLabel(t("time.minutes", { n: minutes }));
                return;
            }
            const hours = Math.floor(minutes / 60);
            if (hours < 24) {
                setLabel(t("time.hours", { n: hours }));
                return;
            }
            const days = Math.floor(hours / 24);
            if (days < 30) {
                setLabel(t("time.days", { n: days }));
                return;
            }
            setLabel(new Date(iso).toLocaleDateString());
        };

        update();
        const timer = setInterval(update, 60_000);
        return () => clearInterval(timer);
    }, [iso, t]);

    return (
        <span className={className} suppressHydrationWarning>
            {label}
        </span>
    );
}
