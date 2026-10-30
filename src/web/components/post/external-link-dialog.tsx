"use client";

import { Modal } from "@/web/components/ui/modal";
import { useI18n } from "@/web/lib/i18n";

interface ExternalLinkDialogProps {
    open: boolean;
    onClose: () => void;
    /** 要跳转的外部地址；为空时不渲染内容 */
    href: string | null;
}

/**
 * 外部链接提示。
 *
 * 为什么需要：帖子里的链接可能是任何站点（包括钓鱼站）。
 * 点一下就无声跳走，用户不知道自己离开了本站 —— 这是社交平台的通用风险。
 * 这里先展示目标域名、让用户确认，是成本最低的保护。
 *
 * 站内链接不走这个弹窗（直接跳转），判断在 `isInternalLink` 里做。
 */
export function ExternalLinkDialog({ open, onClose, href }: ExternalLinkDialogProps) {
    const { t } = useI18n();

    // 展示域名而不是完整 URL：长链接会撑爆弹窗，而域名才是用户判断的依据
    let host = "";
    try {
        host = href ? new URL(href).host : "";
    } catch {
        host = "";
    }

    /**
     * 打开外部链接。
     *
     * 为什么用 window.open 而不是 `<a target="_blank">`：
     * 弹窗所在的面板会随 `onClose` 触发退场动画并重渲染，
     * 若依赖 `<a>` 的默认导航，元素可能在浏览器处理 `_blank` 之前就被卸载，
     * 结果在**当前标签页**跳转（用户会觉得自己被强行带走了）。
     * 显式调用 window.open 并立刻关闭弹窗，行为稳定且可预期。
     */
    function handleContinue() {
        if (!href) return;
        // noopener：新页面拿不到 window.opener，避免被反向控制
        window.open(href, "_blank", "noopener,noreferrer");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            label={t("link.externalTitle")}
            alignClassName="items-center justify-center p-3 sm:p-4"
            panelClassName="surface-raised w-full max-w-sm p-5 sm:p-6"
        >
            {/* portal 到 body，但事件仍会冒泡到卡片；拦住避免触发「进入帖子详情」 */}
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <h2 className="font-display text-[15px] font-black text-fg">{t("link.externalTitle")}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-weak">{t("link.externalHint")}</p>

                {host && (
                    <p className="mt-3 truncate rounded-lg bg-overlay px-3 py-2 font-display text-[13px] font-bold text-brand-ink">
                        {host}
                    </p>
                )}

                {href && (
                    <p className="mt-1.5 break-all text-[11px] leading-relaxed text-fg-mute">{href}</p>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="press-sm cursor-pointer rounded-[10px] border border-line bg-overlay px-4 py-2 font-display text-[13px] font-bold text-fg-weak transition-colors hover:bg-overlay-strong hover:text-fg"
                    >
                        {t("link.stay")}
                    </button>
                    <button
                        type="button"
                        onClick={handleContinue}
                        className="press-sm cursor-pointer rounded-[10px] bg-brand-deep px-4 py-2 font-display text-[13px] font-bold text-white transition-colors hover:bg-brand"
                    >
                        {t("link.continue")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
