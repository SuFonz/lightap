"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
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

            // 等后端返回后再显示：用返回的 id / uuid / uri / content 构造新帖
            const created = await postsApi.createNote(session.token, { content });

            const post = makePost(created.uuid, currentUser.username, created.content, new Date().toISOString());
            post.uri = created.uri;
            post.cursorId = created.id;
            post.likedByMe = created.liked;
            post.likes = created.likeCount;

            // 插到自己的帖子列表顶部（若该用户主页已加载）
            setUserPosts((prev) => {
                const list = prev[currentUser.username];
                if (!list) return prev;
                return { ...prev, [currentUser.username]: appendUnique([post], list) };
            });
            // 插到当前时间线顶部
            setPosts((prev) => appendUnique([post], prev));
        },
        [session, currentUser],
    );

    const reply = useCallback(
        async (target: Post, content: string) => {
            if (!session) throw new Error("请先登录");
            const inReplyTo = target.uri || undefined;

            // 等后端返回后再显示：用返回的数据构造回复
            const created = await postsApi.createNote(session.token, { content, inReplyTo });

            const newReply = makePost(created.uuid, currentUser.username, created.content, new Date().toISOString(), inReplyTo);
            newReply.uri = created.uri;
            newReply.cursorId = created.id;

            // 把回复挂到目标帖下，并让回复数 +1（线程和时间线都更新）
            const append = (item: Post) => ({
                ...item,
                replies: [...item.replies, newReply],
                repliesCount: item.repliesCount + 1,
            });
            setThreads((prev) => {
                const chain = prev[target.id];
                if (!chain) return prev;
                return { ...prev, [target.id]: mapPost(chain, target.id, append) };
            });
            setPosts((prev) => mapPost(prev, target.id, append));
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
        // 个人主页的帖子列表也同步（只动确实包含该帖的那几个列表）
        setUserPosts((prev) => {
            let next = prev;
            for (const [username, list] of Object.entries(prev)) {
                if (!findPost(list, id)) continue;
                if (next === prev) next = { ...prev };
                next[username] = mapPost(list, id, updater);
            }
            return next;
        });
    }, []);

    const toggleLike = useCallback(
        async (post: Post) => {
            if (!session) throw new Error("请先登录");

            const id = post.id;
            const willLike = !post.likedByMe;

            // 立即反馈：先乐观更新
            mutate(id, (item) => ({
                ...item,
                likedByMe: willLike,
                likes: item.likes + (willLike ? 1 : -1),
            }));

            try {
                if (willLike) await postsApi.likeNote(id, session.token);
                else await postsApi.unlikeNote(id, session.token);
            } catch (error) {
                // 服务器失败：回滚到原来的状态
                mutate(id, (item) => ({
                    ...item,
                    likedByMe: !willLike,
                    likes: item.likes + (willLike ? -1 : 1),
                }));
                throw error;
            }
        },
        [session, mutate],
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
