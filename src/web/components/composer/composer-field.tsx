"use client";

import { useState } from "react";
import { ComposerModal } from "@/web/components/composer/composer-modal";
import { Avatar } from "@/web/components/ui/avatar";
import { cn } from "@/web/lib/cn";
import { useDirectory } from "@/web/stores/directory-store";

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
    label = "说点什么吧…",
    title = "发布新帖",
    placeholder,
    submitLabel = "发布",
    maxLength = 500,
    showTips = true,
    className,
    onSubmit,
}: ComposerFieldProps) {
    const { currentUser } = useDirectory();
    const [open, setOpen] = useState(false);

    return (
        <>
            <div
                className={cn(
                    "glass-card cursor-pointer p-4 transition-shadow duration-200 hover:shadow-glow",
                    className,
                )}
                role="button"
                tabIndex={0}
                aria-label="打开发帖框"
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <div className="flex items-center gap-3">
                    <Avatar
                        name={currentUser.displayName}
                        src={currentUser.avatarUrl}
                        size={42}
                    />
                    <p className="min-w-0 flex-1 text-[15px] text-slate-400">{label}</p>
                </div>

                <div className="mt-3 flex items-center gap-0.5 border-t border-white/70 pt-3 pl-[54px]">
                    <span className="btn-solid ml-auto px-4 py-1.5 font-display text-sm font-bold">{submitLabel}</span>
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
