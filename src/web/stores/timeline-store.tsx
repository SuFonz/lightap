"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
import { createId } from "@/web/lib/id";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, NoteItem, Post, PostListItem } from "@/web/types";

const FEED_LIMIT = 30;

interface Pagination {
    hasMore: boolean;
    loadingMore: boolean;
}

type RememberUser = (input: {
    username: string;
    domain?: string | null;
    displayName?: string;
    avatarUrl?: string;
}) => void;

function makePost(id: string, authorUsername: string, content: string, createdAt: string, inReplyTo?: string): Post {
    return {
        id,
        authorUsername,
        content,
        inReplyTo,
        createdAt,
        replies: [],
        repliesCount: 0,
        likes: 0,
        boosts: 0,
        likedByMe: false,
        boostedByMe: false,
    };
}

/** note uri 形如 https://host/notes/<uuid>，取最后一段作为本地 id（详情按 uuid 查） */
function idFromUri(uri: string): string {
    return uri.split("/").pop() ?? uri;
}

function fromListItem(item: PostListItem): Post {
    return {
        ...makePost(
            idFromUri(item.uri),
            item.username,
            item.content,
            new Date(item.createdAt * 1000).toISOString(),
            item.inReplyTo ?? undefined,
        ),
        cursorId: item.id,
        repliesCount: item.repliesCount,
    };
}

function fromNoteItem(item: NoteItem): Post {
    return {
        ...makePost(
            idFromUri(item.uri),
            item.username,
            item.content,
            new Date(item.createdAt * 1000).toISOString(),
            item.inReplyTo ?? undefined,
        ),
        repliesCount: item.repliesCount,
    };
}

/** 把作者信息记进 directory store，顺便支持增量分页 */
function rememberAuthors(items: PostListItem[], rememberUser: RememberUser) {
    for (const item of items) {
        rememberUser({
            username: item.username,
            domain: item.domain,
            displayName: item.displayName,
            avatarUrl: item.avatarUrl,
        });
    }
}

/** 追加去重，按 id 过滤掉已存在的帖子 */
function appendUnique(posts: Post[], next: Post[]): Post[] {
    if (next.length === 0) return posts;
    const seen = new Set(posts.map((post) => post.id));
    const merged = [...posts];
    for (const post of next) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        merged.push(post);
    }
    return merged;
}

function findPost(posts: Post[], id: string): Post | undefined {
    for (const post of posts) {
        if (post.id === id) return post;
        const nested = findPost(post.replies, id);
        if (nested) return nested;
    }
    return undefined;
}

function mapPost(posts: Post[], id: string, updater: (post: Post) => Post): Post[] {
    return posts.map((post) => {
        if (post.id === id) return updater(post);
        if (post.replies.length === 0) return post;
        return { ...post, replies: mapPost(post.replies, id, updater) };
    });
}

interface TimelineValue {
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
    reply: (postId: string, content: string) => Promise<void>;
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
    toggleLike: (id: string) => void;
    toggleBoost: (id: string) => void;
}

const TimelineContext = createContext<TimelineValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const { currentUser, rememberUser } = useDirectory();
    const [posts, setPosts] = useState<Post[]>([]);
    const [threads, setThreads] = useState<Record<string, Post[]>>({});
    const [userPosts, setUserPosts] = useState<Record<string, Post[]>>({});
    const [userPostsMeta, setUserPostsMeta] = useState<Record<string, Pagination>>({});
    const [loading, setLoading] = useState(false);
    const [feedMeta, setFeedMeta] = useState<Pagination>({ hasMore: false, loadingMore: false });
    const [tab, setTab] = useState<FeedTab>("all");

    const fetchPage = useCallback(
        async (target: FeedTab, maxId?: number) => {
            const { items } = await postsApi.fetchFeed(target, { limit: FEED_LIMIT, maxId }, session?.token);
            rememberAuthors(items, rememberUser);
            return items.map(fromListItem);
        },
        [session, rememberUser],
    );

    const loadFeed = useCallback(
        async (target: FeedTab) => {
            setTab(target);
            setLoading(true);
            setFeedMeta({ hasMore: false, loadingMore: false });
            try {
                const page = await fetchPage(target);
                setPosts(page);
                setFeedMeta({ hasMore: page.length === FEED_LIMIT, loadingMore: false });
            } catch {
                setPosts([]);
                setFeedMeta({ hasMore: false, loadingMore: false });
            } finally {
                setLoading(false);
            }
        },
        [fetchPage],
    );

    const loadMore = useCallback(async () => {
        if (loading || feedMeta.loadingMore || !feedMeta.hasMore) return;
        const last = posts[posts.length - 1];
        if (!last?.cursorId) return;

        setFeedMeta((prev) => ({ ...prev, loadingMore: true }));
        try {
            const page = await fetchPage(tab, last.cursorId);
            setPosts((prev) => appendUnique(prev, page));
            setFeedMeta({ hasMore: page.length === FEED_LIMIT, loadingMore: false });
        } catch {
            setFeedMeta((prev) => ({ ...prev, loadingMore: false }));
        }
    }, [loading, feedMeta, posts, tab, fetchPage]);

    const compose = useCallback(
        async (content: string) => {
            if (!session) throw new Error("请先登录");
            await postsApi.createNote(session.token, { content });
            await loadFeed(tab);
        },
        [session, loadFeed, tab],
    );

    const reply = useCallback(
        async (postId: string, content: string) => {
            if (!session) throw new Error("请先登录");
            const inReplyTo = typeof window === "undefined" ? undefined : `${window.location.origin}/notes/${postId}`;
            await postsApi.createNote(session.token, { content, inReplyTo });

            // 立即把回复挂上，并让回复数 +1（线程和时间线都更新）
            const post = makePost(createId(), currentUser.username, content, new Date().toISOString(), inReplyTo);
            const append = (item: Post) => ({
                ...item,
                replies: [...item.replies, post],
                repliesCount: item.repliesCount + 1,
            });
            setThreads((prev) => {
                const chain = prev[postId];
                if (!chain) return prev;
                return { ...prev, [postId]: mapPost(chain, postId, append) };
            });
            setPosts((prev) => mapPost(prev, postId, append));
        },
        [session, currentUser],
    );

    const loadUserPosts = useCallback(
        async (username: string) => {
            if (!username) return;
            try {
                const { items } = await postsApi.fetchUserPosts(username, { limit: FEED_LIMIT }, session?.token);
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserPosts((prev) => ({ ...prev, [username]: page }));
                setUserPostsMeta((prev) => ({ ...prev, [username]: { hasMore: page.length === FEED_LIMIT, loadingMore: false } }));
            } catch {
                setUserPosts((prev) => ({ ...prev, [username]: [] }));
                setUserPostsMeta((prev) => ({ ...prev, [username]: { hasMore: false, loadingMore: false } }));
            }
        },
        [session, rememberUser],
    );

    const loadMoreUserPosts = useCallback(
        async (username: string) => {
            const list = userPosts[username];
            const meta = userPostsMeta[username];
            if (!list || !meta?.hasMore || meta.loadingMore) return;
            const last = list[list.length - 1];
            if (!last?.cursorId) return;

            setUserPostsMeta((prev) => ({ ...prev, [username]: { ...prev[username], loadingMore: true } }));
            try {
                const { items } = await postsApi.fetchUserPosts(
                    username,
                    { limit: FEED_LIMIT, maxId: last.cursorId },
                    session?.token,
                );
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserPosts((prev) => ({ ...prev, [username]: appendUnique(prev[username] ?? [], page) }));
                setUserPostsMeta((prev) => ({ ...prev, [username]: { hasMore: page.length === FEED_LIMIT, loadingMore: false } }));
            } catch {
                setUserPostsMeta((prev) => ({ ...prev, [username]: { ...prev[username], loadingMore: false } }));
            }
        },
        [userPosts, userPostsMeta, session, rememberUser],
    );

    const getPost = useCallback(
        (id: string) => {
            const inFeed = findPost(posts, id);
            if (inFeed) return inFeed;
            for (const chain of Object.values(threads)) {
                const found = findPost(chain, id);
                if (found) return found;
            }
            return undefined;
        },
        [posts, threads],
    );

    const getThread = useCallback((id: string) => threads[id], [threads]);

    const loadThread = useCallback(
        async (id: string) => {
            const { chain, replies } = await postsApi.fetchThread(id, session?.token);
            const mapped = chain.map((item) => {
                rememberUser({ username: item.username, domain: item.domain });
                return fromNoteItem(item);
            });

            const current = mapped[mapped.length - 1];
            if (current) {
                current.id = id;
                current.replies = replies.map((item) => {
                    rememberUser({ username: item.username, domain: item.domain });
                    return fromNoteItem(item);
                });
                current.repliesCount = current.replies.length;
            }

            setThreads((prev) => ({ ...prev, [id]: mapped }));
        },
        [session, rememberUser],
    );

    const mutate = useCallback((id: string, updater: (post: Post) => Post) => {
        setPosts((prev) => mapPost(prev, id, updater));
        setThreads((prev) => {
            const next: Record<string, Post[]> = {};
            for (const [key, chain] of Object.entries(prev)) next[key] = mapPost(chain, id, updater);
            return next;
        });
    }, []);

    const toggleLike = useCallback(
        (id: string) =>
            mutate(id, (post) => ({
                ...post,
                likedByMe: !post.likedByMe,
                likes: post.likes + (post.likedByMe ? -1 : 1),
            })),
        [mutate],
    );

    const toggleBoost = useCallback(
        (id: string) =>
            mutate(id, (post) => ({
                ...post,
                boostedByMe: !post.boostedByMe,
                boosts: post.boosts + (post.boostedByMe ? -1 : 1),
            })),
        [mutate],
    );

    const value = useMemo<TimelineValue>(
        () => ({
            posts,
            loading,
            hasMore: feedMeta.hasMore,
            loadingMore: feedMeta.loadingMore,
            loadFeed,
            loadMore,
            compose,
            reply,
            userPosts,
            userPostsMeta,
            loadUserPosts,
            loadMoreUserPosts,
            getPost,
            getThread,
            loadThread,
            toggleLike,
            toggleBoost,
        }),
        [
            posts,
            loading,
            feedMeta,
            loadFeed,
            loadMore,
            compose,
            reply,
            userPosts,
            userPostsMeta,
            loadUserPosts,
            loadMoreUserPosts,
            getPost,
            getThread,
            loadThread,
            toggleLike,
            toggleBoost,
        ],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineValue {
    const ctx = useContext(TimelineContext);
    if (!ctx) throw new Error("useTimeline must be used within TimelineProvider");
    return ctx;
}
