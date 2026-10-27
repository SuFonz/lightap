"use client";

import { ComposerField } from "@/web/components/composer/composer-field";
import { useI18n } from "@/web/lib/i18n";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";
import type { Post } from "@/web/types";

/**
 * 帖子详情页的回复入口：不再是内联输入框，
 * 改为与「发帖」一致的可点击玻璃条 + 弹窗。
 */
export function ReplyComposer({ post }: { post: Post }) {
    const { isAuthenticated } = useSession();
    const { reply } = useTimeline();
    const { openAuth } = useUi();
    const { t } = useI18n();

    if (!isAuthenticated) {
        return (
            <div
                className="flex items-center justify-between gap-3 border-b border-line py-3"
                aria-label={t("reply.title")}
            >
                <p className="text-[13px] font-semibold text-fg-weak">{t("reply.loginRequired")}</p>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="btn-solid press-sm px-3.5 py-1.5 font-display text-[12px] font-bold"
                >
                    {t("common.login")}
                </button>
            </div>
        );
    }

    return (
        <ComposerField
            label={t("reply.placeholder")}
            title={t("reply.title")}
            placeholder={t("reply.placeholder")}
            submitLabel={t("reply.submit")}
            onSubmit={(content) => reply(post, content)}
        />
    );
}
