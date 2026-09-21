"use client";

import { ComposerField } from "@/web/components/composer/composer-field";
import { useSession } from "@/web/stores/session-store";
import { useTimeline } from "@/web/stores/timeline";
import { useUi } from "@/web/stores/ui-store";

/**
 * 帖子详情页的回复入口：不再是内联输入框，
 * 改为与「发帖」一致的可点击玻璃条 + 弹窗。
 */
export function ReplyComposer({ postId }: { postId: string }) {
    const { isAuthenticated } = useSession();
    const { reply } = useTimeline();
    const { openAuth } = useUi();

    if (!isAuthenticated) {
        return (
            <section className="glass-card flex items-center justify-between gap-3 p-4" aria-label="回复">
                <p className="text-sm font-semibold text-slate-500">登录后即可参与回复</p>
                <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="btn-solid px-4 py-2 font-display text-sm font-bold"
                >
                    登录
                </button>
            </section>
        );
    }

    return (
        <ComposerField
            label="写下你的回复…"
            title="回复帖子"
            placeholder="写下你的回复…"
            submitLabel="回复"
            onSubmit={(content) => reply(postId, content)}
        />
    );
}
