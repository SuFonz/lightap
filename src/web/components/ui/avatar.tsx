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
}

export function Avatar({ name, src, size = 44, ring = false, className }: AvatarProps) {
    const [failed, setFailed] = useState(false);
    const showImage = src && !failed;
    const initial = name.slice(0, 1).toUpperCase();

    return (
        <span
            className={cn(
                "relative inline-flex shrink-0 select-none",
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
