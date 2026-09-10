"use client";

import { useState } from "react";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/client/utils";
import type { User } from "@/lib/types/http";

interface FollowButtonProps {
    user: User;
    size?: "sm" | "md";
    className?: string;
}

export function FollowButton({ user, size = "md", className }: FollowButtonProps) {
    const { isFollowing, toggleFollow, currentUser } = useUserStore();
    const [pending, setPending] = useState(false);
    const following = isFollowing(user.username);

    if (user.username === currentUser.username) return null;

    async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (pending) return;
        setPending(true);
        try {
            await toggleFollow(user);
        } catch {
            // 失败时 store 已回滚状态，这里仅结束 pending
        } finally {
            setPending(false);
        }
    }

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
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
