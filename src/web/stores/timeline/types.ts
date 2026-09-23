import type { FeedTab, Post } from "@/web/types";

export interface Pagination {
    hasMore: boolean;
    loadingMore: boolean;
}

export interface TimelineValue {
    posts: Post[];
    loading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    /** 拉取某个时间线（重置到第一页）：all 全部 / local 本地 / following 关注 */
    loadFeed: (tab: FeedTab) => Promise<void>;
    /** 滚动到底时加载下一页 */
    loadMore: () => Promise<void>;
    /** 发布新帖（发布后刷新当前时间线） */
    compose: (content: string) => Promise<void>;
    /** 回复某个帖子 */
    reply: (post: Post, content: string) => Promise<void>;
    /** 某个用户的帖子（个人主页用），未加载过为 undefined */
    userPosts: Record<string, Post[]>;
    userPostsMeta: Record<string, Pagination>;
    loadUserPosts: (username: string) => Promise<void>;
    loadMoreUserPosts: (username: string) => Promise<void>;
    getPost: (id: string) => Post | undefined;
    /** 返回 [顶层, ..., 当前帖]，未加载过则为 undefined */
    getThread: (id: string) => Post[] | undefined;
    /** 从后端拉取整条线程并缓存 */
    loadThread: (id: string) => Promise<void>;
    /** 点赞 / 取消点赞（乐观更新，失败自动回滚） */
    toggleLike: (post: Post) => Promise<void>;
    toggleBoost: (id: string) => void;
}
