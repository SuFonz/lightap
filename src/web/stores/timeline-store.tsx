"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
import { createId } from "@/web/lib/id";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, NoteItem, Post, PostListItem } from "@/web/types";

const FEED_LIMIT = 30;

function makePost(id: string, authorUsername: string, content: string, createdAt: string, inReplyTo?: string): Post {
    return {
        id,
        authorUsername,
        content,
        inReplyTo,
        createdAt,
        replies: [],
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
    return makePost(
        idFromUri(item.uri),
        item.username,
        item.content,
        new Date(item.createdAt * 1000).toISOString(),
        item.inReplyTo ?? undefined,
    );
}

function fromNoteItem(item: NoteItem): Post {
    return makePost(
        idFromUri(item.uri),
        item.username,
        item.content,
        new Date(item.createdAt * 1000).toISOString(),
        item.inReplyTo ?? undefined,
    );
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
    /** 拉取某个时间线：all 全部 / local 本地 / following 关注 */
    loadFeed: (tab: FeedTab) => Promise<void>;
    /** 发布新帖（发布后刷新当前时间线） */
    compose: (content: string) => Promise<void>;
    /** 回复某个帖子 */
    reply: (postId: string, content: string) => Promise<void>;
    /** 某个用户的帖子（个人主页用），未加载过为 undefined */
    userPosts: Record<string, Post[]>;
    loadUserPosts: (username: string) => Promise<void>;
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
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<FeedTab>("all");

    const fetchFeed = useCallback(
        async (target: FeedTab) => {
            setLoading(true);
            try {
                const { items } = await postsApi.fetchFeed(target, { limit: FEED_LIMIT }, session?.token);
                for (const item of items) {
                    rememberUser({
                        username: item.username,
                        domain: item.domain,
                        displayName: item.displayName,
                        avatarUrl: item.avatarUrl,
                    });
                }
                setPosts(items.map(fromListItem));
            } catch {
                setPosts([]);
            } finally {
                setLoading(false);
            }
        },
        [session, rememberUser],
    );

    const loadFeed = useCallback(
        async (target: FeedTab) => {
            setTab(target);
            await fetchFeed(target);
        },
        [fetchFeed],
    );

    const compose = useCallback(
        async (content: string) => {
            if (!session) throw new Error("请先登录");
            await postsApi.createNote(session.token, { content });
            await fetchFeed(tab);
        },
        [session, fetchFeed, tab],
    );

    const reply = useCallback(
        async (postId: string, content: string) => {
            if (!session) throw new Error("请先登录");
            const inReplyTo = typeof window === "undefined" ? undefined : `${window.location.origin}/notes/${postId}`;
            await postsApi.createNote(session.token, { content, inReplyTo });

            // 立即把回复挂到已加载的线程上
            const post = makePost(createId(), currentUser.username, content, new Date().toISOString(), inReplyTo);
            setThreads((prev) => {
                const chain = prev[postId];
                if (!chain) return prev;
                return { ...prev, [postId]: mapPost(chain, postId, (item) => ({ ...item, replies: [...item.replies, post] })) };
            });
        },
        [session, currentUser],
    );

    const loadUserPosts = useCallback(
        async (username: string) => {
            if (!username) return;
            try {
                const { items } = await postsApi.fetchUserPosts(username, { limit: FEED_LIMIT }, session?.token);
                for (const item of items) {
                    rememberUser({
                        username: item.username,
                        domain: item.domain,
                        displayName: item.displayName,
                        avatarUrl: item.avatarUrl,
                    });
                }
                setUserPosts((prev) => ({ ...prev, [username]: items.map(fromListItem) }));
            } catch {
                setUserPosts((prev) => ({ ...prev, [username]: [] }));
            }
        },
        [session, rememberUser],
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
            loadFeed,
            compose,
            reply,
            userPosts,
            loadUserPosts,
            getPost,
            getThread,
            loadThread,
            toggleLike,
            toggleBoost,
        }),
        [posts, loading, loadFeed, compose, reply, userPosts, loadUserPosts, getPost, getThread, loadThread, toggleLike, toggleBoost],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineValue {
    const ctx = useContext(TimelineContext);
    if (!ctx) throw new Error("useTimeline must be used within TimelineProvider");
    return ctx;
}
