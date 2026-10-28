"use client";

import { useState } from "react";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { Modal } from "@/web/components/ui/modal";

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    /** 标题（如「删除帖子」） */
    title: string;
    /** 正文说明，讲清楚后果 */
    description?: string;
    /** 确认按钮文案 */
    confirmLabel: string;
    /** 取消按钮文案，默认「取消」 */
    cancelLabel?: string;
    /**
     * 危险操作（删除等）用红色确认按钮；
     * 普通操作（如取关）用中性色，避免把一切都做得像警告。
     */
    tone?: "danger" | "default";
    /** 确认回调；返回 Promise 时按钮进入 loading 并禁用，防止重复提交 */
    onConfirm: () => void | Promise<void>;
}

/**
 * 站内确认对话框。
 *
 * 为什么不用 `window.confirm`：
 * - 它是浏览器的系统弹窗，样式与站点完全脱节，深色主题下尤其突兀
 * - 无法用项目的动效体系（入场/退场、按压缩放）
 * - 阻塞主线程，且不同浏览器表现不一致
 *
 * 复用现有 `Modal`：层级、滚动锁定、Esc 关闭、遮罩点击关闭都由它处理。
 * 这里只负责内容与「确认中」的状态。
 */
export function ConfirmDialog({
    open,
    onClose,
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone = "danger",
    onConfirm,
}: ConfirmDialogProps) {
    const { t } = useI18n();
    const [pending, setPending] = useState(false);
    // 未显式传 cancelLabel 时用词典里的「取消」，避免硬编码语言
    const cancelText = cancelLabel ?? t("common.cancel");

    async function handleConfirm() {
        if (pending) return;
        setPending(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setPending(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={pending ? () => {} : onClose}
            label={title}
            alignClassName="items-center justify-center p-3 sm:p-4"
            panelClassName="surface-raised w-full max-w-sm p-5 sm:p-6"
        >
            {/*
              portal 到 body，但 React 事件仍会沿组件树冒泡。
              调用方可能把它放在可点击的卡片里（如帖子卡片整卡可点进详情），
              不拦住的话点对话框会连带触发卡片跳转。
            */}
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <h2 className="font-display text-[16px] font-black text-fg">{title}</h2>
                {description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-fg-weak">{description}</p>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        className="press-sm cursor-pointer rounded-[10px] border border-line bg-overlay px-4 py-2 font-display text-[13px] font-bold text-fg-weak transition-colors hover:bg-overlay-strong hover:text-fg disabled:opacity-60"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={pending}
                        className={cn(
                            "press-sm cursor-pointer rounded-[10px] px-4 py-2 font-display text-[13px] font-bold text-white transition-colors disabled:opacity-60",
                            // 危险操作用实心红，普通操作用强调色
                            tone === "danger" ? "bg-red-500 hover:bg-red-600" : "btn-solid",
                        )}
                    >
                        {pending ? "…" : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
