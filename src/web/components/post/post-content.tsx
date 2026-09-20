"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { TagPill } from "@/web/components/ui/tag-pill";

/** 把正文里的 #话题 和 @提及 渲染成可点击元素。 */
export function PostContent({
    content,
    onTagClick,
}: {
    content: string;
    onTagClick?: (e: React.MouseEvent) => void;
}) {
    const parts = content.split(/(#[^\s#]+|@[^\s@]+)/g);

    return (
        <>
            {parts.map((part, i): ReactNode => {
                if (/^#[^\s#]+/.test(part)) {
                    return (
                        <TagPill
                            key={i}
                            label={part}
                            href={`/search?q=${encodeURIComponent(part.slice(1))}`}
                            onClick={onTagClick}
                        />
                    );
                }
                if (/^@[^\s@]+/.test(part)) {
                    return (
                        <Link
                            key={i}
                            href={`/u/${part.slice(1)}`}
                            onClick={onTagClick}
                            className="font-bold text-brand-deep hover:underline"
                        >
                            {part}
                        </Link>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}
