"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { SearchHistoryList } from "@/web/components/search/search-history-list";
import { CloseIcon, SearchIcon } from "@/web/components/ui/icons";
import { Popover } from "@/web/components/ui/popover";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { useSearchHistory } from "@/web/hooks/use-search-history";

interface SearchBoxProps {
    className?: string;
    autoFocus?: boolean;
    placeholder?: string;
}

export function SearchBox({ className, autoFocus = false, placeholder }: SearchBoxProps) {
    const router = useRouter();
    const { t } = useI18n();
    const { history, add, remove, clear } = useSearchHistory();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);
    const placeholderText = placeholder ?? t("search.placeholder");

    function runSearch(term: string) {
        const value = term.trim();
        if (!value) return;
        add(value);
        setQuery(value);
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(value)}`);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        runSearch(query);
    }

    return (
        <div ref={anchorRef} className={cn("relative", className)}>
            <form onSubmit={handleSubmit} role="search" onFocus={() => setOpen(true)}>
                <label className="flex items-center gap-2.5 rounded-full border border-line bg-overlay-weak px-4 py-2.5 transition-colors duration-150 focus-within:border-brand/40 focus-within:bg-overlay">
                    <SearchIcon size={16} className="shrink-0 text-fg-mute" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        // 不用 onBlur 关闭浮层：拖动历史列表的滚动条会让输入框
                        // 失焦，浮层就会在拖到一半时消失，滚动条等于白加。
                        // 关闭交给 Popover 的 onClose（点击浮层与输入框之外 / Esc），
                        // 这也更符合常见搜索框的行为：输入时列表一直开着。
                        placeholder={placeholderText}
                        aria-label={t("search.action")}
                        autoFocus={autoFocus}
                        autoComplete="off"
                        className="w-full bg-transparent text-sm font-medium text-fg placeholder:text-fg-mute focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label={t("search.clear")}
                            onClick={() => setQuery("")}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-mute transition hover:bg-brand/10 hover:text-brand-deep"
                        >
                            <CloseIcon size={14} />
                        </button>
                    )}
                </label>
            </form>

            {/* 浮层里按下指针不会让它关闭（内部点击不算「外部」），
                所以拖滚动条安全；点外部或按 Esc 才关 */}
            <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
                <SearchHistoryList
                    history={history}
                    onPick={runSearch}
                    onRemove={remove}
                    // 清空后列表为空、浮层没有内容可显示，顺手关掉
                    onClear={() => {
                        clear();
                        setOpen(false);
                    }}
                />
            </Popover>
        </div>
    );
}
