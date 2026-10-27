"use client";

import { useState } from "react";
import { ComposerModal } from "@/web/components/composer/composer-modal";
import { Avatar } from "@/web/components/ui/avatar";
import { useI18n } from "@/web/lib/i18n";
import { useDirectory } from "@/web/stores/directory";

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

/**
 * 发布 / 回复入口。
 *
 * 它是一行可点击的内容，不是一张卡片——
 * 用一条 hairline 与下面的时间线分隔，hover 时边框微微染色作为可点的提示。
 * 真正的独立表面只留给弹出的编辑框（ComposerModal）。
 */
export function ComposerField({
    label,
    title,
    placeholder,
    submitLabel,
    maxLength = 500,
    showTips = true,
    className,
    onSubmit,
}: ComposerFieldProps) {
    const { currentUser } = useDirectory();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);

    const labelText = label ?? t("composer.placeholder");
    const titleText = title ?? t("composer.title");
    const submitText = submitLabel ?? t("composer.submit");

    return (
        <>
            <div
                className={className}
                role="button"
                tabIndex={0}
                aria-label={t("composer.open")}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <div className="press flex cursor-pointer items-center gap-3 border-b border-line py-3 transition-colors duration-150 hover:border-brand/30">
                    <Avatar name={currentUser.displayName} src={currentUser.avatarUrl} size={38} />
                    <p className="min-w-0 flex-1 text-[14px] text-fg-mute">{labelText}</p>
                    <span className="btn-solid pointer-events-none shrink-0 px-3.5 py-1.5 font-display text-[12px] font-bold">
                        {submitText}
                    </span>
                </div>
            </div>

            <ComposerModal
                open={open}
                onClose={() => setOpen(false)}
                title={titleText}
                submitLabel={submitText}
                placeholder={placeholder}
                maxLength={maxLength}
                showTips={showTips}
                onSubmit={onSubmit}
            />
        </>
    );
}
