"use client";

import { useState, type ComponentType } from "react";
import { Avatar } from "@/components/avatar";
import { ComposerModal } from "@/components/composer-modal";
// import { EmojiIcon, HashIcon, ImageIcon, PollIcon, WarnIcon } from "@/components/icons";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/client/utils";

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

function ComposerTool({
    icon: IconCmp,
    label,
    tone,
}: {
    icon: ComponentType<{ size?: number }>;
    label: string;
    tone: string;
}) {
    return (
        <span
            title={label}
            aria-hidden="true"
            className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-white/80",
                tone,
            )}
        >
            <IconCmp size={17} />
        </span>
    );
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
    const { currentUser } = useUserStore();
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
                        status={currentUser.online}
                    />
                    <p className="min-w-0 flex-1 text-[15px] text-slate-400">{label}</p>
                </div>

                <div className="mt-3 flex items-center gap-0.5 border-t border-white/70 pt-3 pl-[54px]">
                    {/* 功能未实现，暂时注释：
                    <ComposerTool icon={ImageIcon} label="图片" tone="hover:text-brand-deep" />
                    <ComposerTool icon={EmojiIcon} label="表情" tone="hover:text-magic-deep" />
                    <ComposerTool icon={HashIcon} label="话题标签" tone="hover:text-brand-deep" />
                    {showTips && <ComposerTool icon={PollIcon} label="投票" tone="hover:text-magic-deep" />}
                    {showTips && <ComposerTool icon={WarnIcon} label="内容警告" tone="hover:text-sakura-deep" />}
                    */}
                    <span className="btn-solid ml-auto px-4 py-1.5 font-display text-sm font-bold">
                        {submitLabel}
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
