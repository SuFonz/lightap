"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
import { createId } from "@/web/lib/id";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, Post } from "@/web/types";
import { TimelineContext } from "./context";
import { appendUnique, findPost, fromListItem, fromNoteItem, makePost, mapPost, rememberAuthors } from "./helpers";
import type { Pagination, TimelineValue } from "./types";

const FEED_LIMIT = 30;

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
            const inReplyTo =
                typeof window === "undefined" ? undefined : `${window.location.origin}/notes/${postId}`;
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
                setUserPostsMeta((prev) => ({
                    ...prev,
                    [username]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
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
                setUserPostsMeta((prev) => ({
                    ...prev,
                    [username]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
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
