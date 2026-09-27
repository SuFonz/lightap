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
            <section className="glass-card flex items-center justify-between gap-3 p-4" aria-label={t("reply.title")}>
                <p className="text-sm font-semibold text-slate-500">{t("reply.loginRequired")}</p>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="btn-solid px-4 py-2 font-display text-sm font-bold"
                >
                    {t("common.login")}
                </button>
            </section>
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
