"use client";

import { useState } from "react";
import { cn } from "@/web/lib/cn";

const gradients = [
    "from-sky-300 to-blue-500",
    "from-pink-300 to-fuchsia-400",
    "from-violet-300 to-indigo-400",
    "from-cyan-300 to-sky-500",
    "from-blue-300 to-violet-400",
    "from-rose-300 to-pink-500",
];

function gradientFor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return gradients[Math.abs(hash) % gradients.length];
}

export interface AvatarProps {
    name: string;
    src?: string;
    size?: number;
    ring?: boolean;
    className?: string;
    /** 外层可点击时传 true：hover 轻微放大，给出「这里能点」的反馈 */
    interactive?: boolean;
}

export function Avatar({ name, src, size = 44, ring = false, className, interactive = false }: AvatarProps) {
    const [failed, setFailed] = useState(false);
    const showImage = src && !failed;
    const initial = name.slice(0, 1).toUpperCase();

    return (
        <span
            className={cn(
                "relative inline-flex shrink-0 select-none",
                // 只动 transform：不触发布局，时间线里大量头像也不会拖慢滚动。
                // 包在 hover 媒体查询里：触屏设备没有真正的 hover，
                // 否则点一下会残留放大状态。
                interactive &&
                    "transition-transform duration-200 ease-[var(--ease-spring)] [@media(hover:hover)]:hover:scale-105",
                ring && "rounded-full ring-2 ring-white/90 outline outline-2 outline-brand/25",
                className,
            )}
            style={{ width: size, height: size }}
            aria-hidden="true"
        >
            <span
                className={cn(
                    "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-display font-extrabold text-white shadow-sm",
                    gradientFor(name),
                )}
                style={{ fontSize: Math.round(size * 0.42) }}
            >
                {showImage ? (
                    <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setFailed(true)}
                        draggable={false}
                    />
                ) : (
                    initial
                )}
            </span>
        </span>
    );
}
