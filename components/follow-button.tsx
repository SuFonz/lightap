"use client";

import { useState, type FormEvent } from "react";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
    username: string;
    size?: "sm" | "md";
    className?: string;
}

export function FollowButton({ username, size = "md", className }: FollowButtonProps) {
    const { isFollowing, toggleFollow, currentUser } = useStore();
    const [pending, setPending] = useState(false);
    const following = isFollowing(username);

    if (username === currentUser.username) return null;

    async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (pending) return;
        setPending(true);
        try {
            await toggleFollow(username);
        } finally {
            setPending(false);
        }
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
    }

    return (
        <form onSubmit={handleSubmit}>
            <button
                type="button"
                onClick={handleClick}
                disabled={pending}
                aria-pressed={following}
                className={cn(
                    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-display font-bold transition-all duration-200 active:scale-95 disabled:opacity-60",
                    size === "sm" ? "h-8 px-3.5 text-xs" : "h-10 px-5 text-sm",
                    following
                        ? "border border-sky-200 bg-white/70 text-sky-600 hover:border-sky-300 hover:bg-sky-50"
                        : "bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/35",
                    className,
                )}
            >
                {following ? "已关注" : pending ? "…" : "关注"}
            </button>
        </form>
    );
}
