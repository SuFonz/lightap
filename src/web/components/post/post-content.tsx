"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { TagPill } from "@/web/components/ui/tag-pill";
import { ExternalLinkDialog } from "@/web/components/post/external-link-dialog";
import { isInternalLink, parseMention, tokenizeContent } from "@/web/lib/links";
import { profileHref } from "@/web/lib/user";

/**
 * 正文渲染：把 `#话题`、`@提及`、裸链接 渲染成可交互元素。
 *
 * 链接的两种处理：
 * - **站内链接**（host 与当前站点相同）→ 直接跳转，不打扰
 * - **站外链接** → 先弹提示，让用户确认后再打开新标签页
 *
 * 为什么要提示：帖子内容来自联邦网络，链接指向任何站点都可能。
 * 一键无声跳走是钓鱼链接的常见入口，社交平台普遍会先提示。
 */
export function PostContent({
    content,
    onTagClick,
}: {
    content: string;
    /** 点击话题 / 提及 / 链接时阻止冒泡（避免触发「进入帖子详情」） */
    onTagClick?: (e: React.MouseEvent) => void;
}) {
    // 待确认的外部链接（null 表示没有待确认的）
    const [pendingExternal, setPendingExternal] = useState<string | null>(null);

    const tokens = tokenizeContent(content);
    // 当前站点 host：本地是 localhost:3000，生产是实际域名。
    // 用 window.location 取值，避免和服务端渲染时的假设不一致。
    const selfHost = typeof window === "undefined" ? "" : window.location.host;

    return (
        <>
            {tokens.map((token, i): ReactNode => {
                if (token.type === "hashtag") {
                    // 话题目前没有落地页（搜索接口只查用户），不做成链接，避免跳进空结果页
                    return <TagPill key={i} label={token.value} />;
                }

                if (token.type === "mention") {
                    // 完整 acct（@user@domain）要带 ?domain= 才能定位到远程那个人；
                    // 只用 slice(1) 拼出 /u/user@domain 是错的，查不到。
                    const { username, domain } = parseMention(token.value);
                    return (
                        <Link
                            key={i}
                            href={profileHref({ username, domain })}
                            onClick={onTagClick}
                            className="font-bold text-brand-deep hover:underline"
                        >
                            {token.value}
                        </Link>
                    );
                }

                if (token.type === "link") {
                    const internal = isInternalLink(token.href, selfHost);

                    if (internal) {
                        // 站内链接：同源跳转，不需要提示
                        return (
                            <a
                                key={i}
                                href={token.href}
                                onClick={onTagClick}
                                className="break-all font-semibold text-brand-deep underline decoration-brand/40 underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
                            >
                                {token.value}
                            </a>
                        );
                    }

                    return (
                        <a
                            key={i}
                            href={token.href}
                            onClick={(e) => {
                                // 阻止默认跳转：先弹提示，用户确认后再打开
                                e.preventDefault();
                                onTagClick?.(e);
                                setPendingExternal(token.href);
                            }}
                            className="break-all font-semibold text-brand-deep underline decoration-brand/40 underline-offset-2 transition-colors hover:text-brand hover:decoration-brand"
                            // 保留 href 让浏览器能显示链接预览，也便于复制
                        >
                            {token.value}
                        </a>
                    );
                }

                return <span key={i}>{token.value}</span>;
            })}

            <ExternalLinkDialog
                open={pendingExternal !== null}
                onClose={() => setPendingExternal(null)}
                href={pendingExternal}
            />
        </>
    );
}
