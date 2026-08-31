"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/client/utils";

interface RelativeTimeProps {
    iso: string;
    className?: string;
}

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
