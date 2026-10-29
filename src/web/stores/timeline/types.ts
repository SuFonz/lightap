import type { FeedTab, FollowDirection, FollowUser, Post, PostListItem } from "@/web/types";

export interface Pagination {
    hasMore: boolean;
    loadingMore: boolean;
}

export interface TimelineValue {
    posts: Post[];
    /** live（SSE 新帖）段条数，用于在 live/history 分界处画分隔线 */
    liveCount: number;
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
    /** 某个用户的帖子（个人主页「帖子」标签页），key 见 postsKey(username, domain, "posts") */
    userPosts: Record<string, Post[]>;
    userPostsMeta: Record<string, Pagination>;
    loadUserPosts: (username: string, domain?: string | null) => Promise<void>;
    loadMoreUserPosts: (username: string, domain?: string | null) => Promise<void>;
    /** 某个用户的回复（个人主页「回复」标签页），key 见 postsKey(username, domain, "replies") */
    userReplies: Record<string, Post[]>;
    userRepliesMeta: Record<string, Pagination>;
    loadUserReplies: (username: string, domain?: string | null) => Promise<void>;
    loadMoreUserReplies: (username: string, domain?: string | null) => Promise<void>;
    /** 关注 / 粉丝列表，key 见 followListKey */
    followLists: Record<string, FollowUser[]>;
    followListsMeta: Record<string, Pagination>;
    loadFollowList: (
        username: string,
        domain: string | null | undefined,
        direction: FollowDirection,
    ) => Promise<void>;
    loadMoreFollowList: (
        username: string,
        domain: string | null | undefined,
        direction: FollowDirection,
    ) => Promise<void>;
    getPost: (id: string) => Post | undefined;
    /** 返回 [顶层, ..., 当前帖]，未加载过则为 undefined */
    getThread: (id: string) => Post[] | undefined;
    /** 从后端拉取整条线程并缓存 */
    loadThread: (id: string) => Promise<void>;
    /** 点赞 / 取消点赞（乐观更新，失败自动回滚） */
    toggleLike: (post: Post) => Promise<void>;
    /** 转发 / 取消转发（乐观更新，失败自动回滚） */
    toggleBoost: (post: Post) => Promise<void>;
    /** 删除自己的帖子（成功后从时间线 / 线程 / 主页列表移除） */
    deletePost: (post: Post) => Promise<void>;
    /** 收到「全部」实时新帖（SSE note.created） */
    applyRemoteNote: (item: PostListItem) => void;
    /** 收到「已关注」实时新帖（SSE following.note，服务端定向推送） */
    applyFollowingNote: (item: PostListItem) => void;
    /** 收到实时转发（SSE announce.created）：把这条帖子标记为「被转发」并置顶 */
    applyRemoteAnnounce: (item: PostListItem) => void;
    /** 收到实时取消转发（SSE announce.removed）：撤掉转发标记 */
    applyRemoteAnnounceRemoved: (payload: { noteUuid: string; actorUsername?: string }) => void;
    /** SSE 重连后补漏：拉最新的帖子合并进来 */
    syncNew: () => Promise<void>;
    /** 收到实时回复（SSE）时给父帖评论数 +1 */
    applyRemoteReply: (payload: { parentUuid: string; actorUsername?: string }) => void;
    /** 收到实时点赞（SSE）时给对应帖子点赞数 +1 */
    applyRemoteLike: (payload: { noteUuid: string }) => void;
}
