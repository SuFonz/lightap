"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { SearchHistoryList } from "@/components/search/search-history-list";
import { useSearchHistory } from "@/components/search/use-search-history";
import { cn } from "@/lib/client/utils";

interface SearchBoxProps {
    className?: string;
    autoFocus?: boolean;
    placeholder?: string;
}

export function SearchBox({
    className,
    autoFocus = false,
    placeholder = "搜索用户…",
}: SearchBoxProps) {
    const router = useRouter();
    const { history, add, remove, clear } = useSearchHistory();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    function runSearch(term: string) {
        const t = term.trim();
        if (!t) return;
        add(t);
        setQuery(t);
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(t)}`);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        runSearch(query);
    }

    return (
        <div className={cn("relative", className)}>
            <form
                onSubmit={handleSubmit}
                role="search"
                onFocus={() => setOpen(true)}
            >
                <label className="glass-card flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-shadow focus-within:shadow-glow">
                    <SearchIcon size={17} className="shrink-0 text-brand" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onBlur={() => setTimeout(() => setOpen(false), 120)}
                        placeholder={placeholder}
                        aria-label="搜索"
                        autoFocus={autoFocus}
                        autoComplete="off"
                        className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="清空搜索"
                            onClick={() => setQuery("")}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-brand/10 hover:text-brand-deep"
                        >
                            <CloseIcon size={14} />
                        </button>
                    )}
                </label>
            </form>

            <SearchHistoryList
                open={open}
                history={history}
                onPick={runSearch}
                onRemove={remove}
                onClear={clear}
            />
        </div>
    );
}
