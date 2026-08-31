import { seedTrends } from "@/lib/client/mock-data";
import type { TrendingTag } from "@/lib/client/types";

export interface TrendingStoreValue {
    trends: TrendingTag[];
}

export function useTrendingStore(): TrendingStoreValue {
    return { trends: seedTrends };
}
