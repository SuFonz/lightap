"use client";

import { CloseIcon, HistoryIcon } from "@/web/components/ui/icons";

interface SearchHistoryListProps {
    history: string[];
    onPick: (term: string) => void;
    onRemove: (term: string) => void;
    onClear: () => void;
}

/**
 * 搜索历史下拉内容。定位与层级由外层 `Popover` 负责（portal 到 body），
 * 这里只渲染内容，避免被祖先的 overflow / 层叠上下文裁剪。
 */
export function SearchHistoryList({ history, onPick, onRemove, onClear }: SearchHistoryListProps) {
    if (history.length === 0) return null;

    return (
        <div
            className="glass-card w-full overflow-hidden rounded-2xl p-2 shadow-xl shadow-brand/20"
            role="listbox"
            aria-label="搜索历史"
        >
            <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-bold text-slate-400">最近搜索</span>
                <button
                    type="button"
                    onClick={onClear}
                    className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-400 transition hover:bg-white/70 hover:text-sakura-deep"
                >
                    清空
                </button>
            </div>
            <ul className="flex flex-col">
                {history.map((term) => (
                    <li key={term} className="group flex items-center gap-1">
                        <button
                            type="button"
                            role="option"
                            aria-selected="false"
                            onClick={() => onPick(term)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-slate-600 transition hover:bg-white/60 hover:text-brand-deep"
                        >
                            <HistoryIcon size={15} className="shrink-0 text-slate-400" />
                            <span className="truncate">{term}</span>
                        </button>
                        <button
                            type="button"
                            aria-label={`删除搜索记录 ${term}`}
                            onClick={() => onRemove(term)}
                            className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-brand/10 hover:text-brand-deep"
                        >
                            <CloseIcon size={14} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
