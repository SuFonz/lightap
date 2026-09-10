import type { TrendingTag } from "@/lib/types/http";

export interface TrendingStoreValue {
    trends: TrendingTag[];
}

export function useTrendingStore(): TrendingStoreValue {
    return { trends: [] };
}
