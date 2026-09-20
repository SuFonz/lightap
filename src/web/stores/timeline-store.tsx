"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { postsApi } from "@/web/lib/api";
import { createId } from "@/web/lib/id";
import { readStorage, writeStorage } from "@/web/lib/storage";
import { useDirectory } from "@/web/stores/directory-store";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, NoteItem, Post } from "@/web/types";

const FEED_KEY = "timeline";

function makePost(id: string, authorUsername: string, content: string, inReplyTo?: string): Post {
    return {
        id,
        authorUsername,
        content,
        inReplyTo,
        createdAt: new Date().toISOString(),
        replies: [],
        likes: 0,
        boosts: 0,
        likedByMe: false,
        boostedByMe: false,
    };
}

function fromNoteItem(item: NoteItem): Post {
    return makePost(`${item.username}@${item.domain}#${createId("note")}`, item.username, item.content, item.inReplyTo ?? undefined);
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
    loadFeed: (tab: FeedTab) => Promise<void>;
    /** 发布新帖 */
    compose: (content: string) => Promise<void>;
    /** 回复某个帖子 */
    reply: (postId: string, content: string) => Promise<void>;
    getPost: (id: string) => Post | undefined;
    /** 返回 [顶层, ..., 当前帖] */
    getThread: (id: string) => Post[] | undefined;
    /** 本地没有时从后端拉取整条线程并缓存 */
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
    const [loading, setLoading] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    // 时间线在后端接口就绪前先持久化在本地
    useEffect(() => {
        setPosts(readStorage<Post[]>(FEED_KEY, []));
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) writeStorage(FEED_KEY, posts);
    }, [hydrated, posts]);

    const loadFeed = useCallback(async (_tab: FeedTab) => {
        setLoading(true);
        setLoading(false);
    }, []);

    const compose = useCallback(
        async (content: string) => {
            if (!session) throw new Error("请先登录");
            await postsApi.createNote(session.token, { content });
            setPosts((prev) => [makePost(createId(), currentUser.username, content), ...prev]);
        },
        [session, currentUser],
    );

    const reply = useCallback(
        async (postId: string, content: string) => {
            if (!session) throw new Error("请先登录");
            const target = findPost(posts, postId);
            // 本地帖子没有后端 uri，只有真实 uuid 才能构造 inReplyTo
            const inReplyTo =
                target && !target.id.startsWith("local-") && typeof window !== "undefined"
                    ? `${window.location.origin}/notes/${target.id}`
                    : undefined;
            await postsApi.createNote(session.token, { content, inReplyTo });
            const post = makePost(createId(), currentUser.username, content, postId);
            setPosts((prev) => mapPost(prev, postId, (item) => ({ ...item, replies: [...item.replies, post] })));
        },
        [session, currentUser, posts],
    );

    const getPost = useCallback((id: string) => findPost(posts, id), [posts]);

    const getThread = useCallback(
        (id: string) => {
            const cached = threads[id];
            if (cached) return cached;

            const post = findPost(posts, id);
            if (!post) return undefined;

            const chain = [post];
            let cursor = post;
            while (cursor.inReplyTo) {
                const parent = findPost(posts, cursor.inReplyTo);
                if (!parent) break;
                chain.unshift(parent);
                cursor = parent;
            }
            return chain;
        },
        [posts, threads],
    );

    const loadThread = useCallback(
        async (id: string) => {
            if (threads[id] || findPost(posts, id)) return;

            const { chain, replies } = await postsApi.fetchThread(id, session?.token);
            const mapped = chain.map((item) => {
                rememberUser(item.username, item.domain);
                return fromNoteItem(item);
            });

            const current = mapped[mapped.length - 1];
            if (current) {
                current.id = id;
                current.replies = replies.map((item) => {
                    rememberUser(item.username, item.domain);
                    return fromNoteItem(item);
                });
            }

            setThreads((prev) => ({ ...prev, [id]: mapped }));
        },
        [posts, threads, session, rememberUser],
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
        () => ({ posts, loading, loadFeed, compose, reply, getPost, getThread, loadThread, toggleLike, toggleBoost }),
        [posts, loading, loadFeed, compose, reply, getPost, getThread, loadThread, toggleLike, toggleBoost],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineValue {
    const ctx = useContext(TimelineContext);
    if (!ctx) throw new Error("useTimeline must be used within TimelineProvider");
    return ctx;
}
