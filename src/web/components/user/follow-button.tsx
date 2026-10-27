"use client";

import { useState } from "react";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { usePulseOnChange } from "@/web/hooks/use-pulse-on-change";
import { useDirectory } from "@/web/stores/directory";
import type { User } from "@/web/types";

interface FollowButtonProps {
    user: User;
    size?: "sm" | "md";
    className?: string;
}

export function FollowButton({ user, size = "md", className }: FollowButtonProps) {
    const { isFollowing, toggleFollow, currentUser } = useDirectory();
    const { t } = useI18n();
    const [pending, setPending] = useState(false);
    const following = isFollowing(user);
    // 关注成功时按钮轻弹一下，让状态切换有明确的即时反馈
    const followPulseKey = usePulseOnChange(following);

    // 只隐藏「自己的」按钮：远程同名用户（如别家实例的 admin）不是自己，要能关注
    if (user.username === currentUser.username && user.instance === currentUser.instance) return null;

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

    return (
        <button
            key={followPulseKey}
            type="button"
            onClick={handleClick}
            disabled={pending}
            aria-pressed={following}
            className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 font-display font-bold transition-all duration-200 active:scale-95 disabled:opacity-60",
                // 关注成功那一下轻弹，给出「已经加上了」的确认
                followPulseKey > 0 && "count-bump",
                size === "sm" ? "h-8 px-3.5 text-xs" : "h-9 px-4 text-sm",
                following
                    ? "rounded-[10px] border border-line bg-overlay text-brand-deep hover:bg-overlay-strong"
                    : "btn-solid",
                className,
            )}
        >
            {following ? t("user.following") : pending ? "…" : t("user.follow")}
        </button>
    );
}
