"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { ComposerModal } from "@/components/composer-modal";
import { FeatherIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

interface ComposerFieldProps {
    label?: string;
    title?: string;
    placeholder?: string;
    submitLabel?: string;
    maxLength?: number;
    showTips?: boolean;
    className?: string;
    onSubmit: (content: string) => Promise<void> | void;
}

export function ComposerField({
    label = "说点什么和大家分享吧…",
    title = "发布新帖",
    placeholder,
    submitLabel = "发布",
    maxLength = 500,
    showTips = true,
    className,
    onSubmit,
}: ComposerFieldProps) {
    const { currentUser } = useStore();
    const [open, setOpen] = useState(false);

    return (
        <>
            <div
                className={cn(
                    "glass-card cursor-pointer px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow",
                    className,
                )}
                onClick={() => setOpen(true)}
            >
                <div className="flex items-center gap-3">
                    <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={40} />
                    <p className="min-w-0 flex-1 truncate rounded-full border border-white/70 bg-white/60 px-4 py-2.5 text-sm text-slate-400">
                        {label}
                    </p>
                    <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/30"
                    >
                        <FeatherIcon size={17} />
                    </span>
                </div>
            </div>

            <ComposerModal
                open={open}
                onClose={() => setOpen(false)}
                title={title}
                submitLabel={submitLabel}
                placeholder={placeholder}
                maxLength={maxLength}
                showTips={showTips}
                onSubmit={onSubmit}
            />
        </>
    );
}
