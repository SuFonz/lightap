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
                    "inline-flex cursor-pointer items-center justify-center gap-1.5 font-display font-bold transition-all duration-200 active:scale-95 disabled:opacity-60",
                    size === "sm" ? "h-8 px-3.5 text-xs" : "h-9 px-4 text-sm",
                    following
                        ? "rounded-[10px] border border-white/80 bg-white/60 text-brand-deep hover:bg-white/90"
                        : "btn-solid",
                    className,
                )}
            >
                {following ? "已关注" : pending ? "…" : "关注"}
            </button>
        </form>
    );
}
