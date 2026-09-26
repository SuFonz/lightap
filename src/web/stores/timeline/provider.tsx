"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, Post, PostListItem } from "@/web/types";
import { TimelineContext } from "./context";
import { appendUnique, findPost, fromListItem, fromNoteItem, makePost, mapPost, mergeLive, removePost, rememberAuthors } from "./helpers";
import type { Pagination, TimelineValue } from "./types";

const FEED_LIMIT = 30;
/** 补漏时最多向上翻几页，防止极端情况一直拉 */
const MAX_CATCHUP_PAGES = 5;
const FEED_TABS: FeedTab[] = ["all", "local", "following"];

interface FeedState {
    /** SSE 新帖（id > sinceId），新的在前 */
    live: Post[];
    /** GET 分页的历史，新的在前 */
    history: Post[];
    /** 已加载部分里最新一条的 id（live / history 分界） */
    sinceId: number | null;
    /** 是否已加载过（用于切 tab 时走缓存） */
    loaded: boolean;
    loading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
}

function emptyFeed(): FeedState {
    return { live: [], history: [], sinceId: null, loaded: false, loading: false, hasMore: false, loadingMore: false };
}

export function TimelineProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const { currentUser, rememberUser, isFollowing } = useDirectory();

    const [feeds, setFeeds] = useState<Record<FeedTab, FeedState>>(() => ({
        all: emptyFeed(),
        local: emptyFeed(),
        following: emptyFeed(),
    }));
    const [threads, setThreads] = useState<Record<string, Post[]>>({});
    const [userPosts, setUserPosts] = useState<Record<string, Post[]>>({});
    const [userPostsMeta, setUserPostsMeta] = useState<Record<string, Pagination>>({});
    const [tab, setTab] = useState<FeedTab>("all");

    // 用 ref 读取最新 feeds，避免 callback 依赖 feeds 而频繁变化
    const feedsRef = useRef(feeds);
    feedsRef.current = feeds;

    const active = feeds[tab];
    const posts = useMemo(() => [...active.live, ...active.history], [active]);

    const patchFeed = useCallback(
        (target: FeedTab, patch: Partial<FeedState> | ((prev: FeedState) => Partial<FeedState>)) => {
            setFeeds((prev) => {
                const current = prev[target];
                const next = typeof patch === "function" ? patch(current) : patch;
                return { ...prev, [target]: { ...current, ...next } };
            });
        },
        [],
    );

    const fetchPage = useCallback(
        async (target: FeedTab, opts: { maxId?: number; sinceId?: number } = {}) => {
            const { items } = await postsApi.fetchFeed(target, { limit: FEED_LIMIT, ...opts });
            rememberAuthors(items, rememberUser);
            return items.map(fromListItem);
        },
        [rememberUser],
    );

    const loadFeed = useCallback(
        async (target: FeedTab) => {
            setTab(target);
            // 已经加载过的 tab 直接用缓存，切回来不再发 GET
            if (feedsRef.current[target].loaded) return;

            patchFeed(target, { loading: true, hasMore: false, loadingMore: false });
            try {
                const page = await fetchPage(target);
                const topId = page[0]?.cursorId ?? null;
                patchFeed(target, (prev) => ({
                    // GET 期间可能已从 SSE 收到更新的帖，保留比 sinceId 还新的
                    live: prev.live.filter((p) => p.cursorId != null && topId != null && p.cursorId > topId),
                    history: page,
                    sinceId: topId,
                    loaded: true,
                    loading: false,
                    hasMore: page.length === FEED_LIMIT,
                    loadingMore: false,
                }));
            } catch {
                patchFeed(target, {
                    live: [],
                    history: [],
                    sinceId: null,
                    loaded: true,
                    loading: false,
                    hasMore: false,
                    loadingMore: false,
                });
            }
        },
        [fetchPage, patchFeed],
    );

    const loadMore = useCallback(async () => {
        const state = feedsRef.current[tab];
        if (state.loading || state.loadingMore || !state.hasMore) return;
        const last = state.history[state.history.length - 1];
        if (!last?.cursorId) return;

        patchFeed(tab, { loadingMore: true });
        try {
            const page = await fetchPage(tab, { maxId: last.cursorId });
            patchFeed(tab, (prev) => ({
                history: appendUnique(prev.history, page),
                hasMore: page.length === FEED_LIMIT,
                loadingMore: false,
            }));
        } catch {
            patchFeed(tab, { loadingMore: false });
        }
    }, [tab, fetchPage, patchFeed]);

    // 向上补漏：从 sinceId 往上翻，直到不足一页或达到上限
    const catchUp = useCallback(
        async (target: FeedTab, fromSinceId: number) => {
            const collected: Post[] = [];
            let upper: number | undefined;
            for (let i = 0; i < MAX_CATCHUP_PAGES; i++) {
                const page = await fetchPage(target, { sinceId: fromSinceId, maxId: upper });
                collected.push(...page);
                if (page.length < FEED_LIMIT) break;
                const oldest = page[page.length - 1]?.cursorId;
                if (oldest == null) break;
                upper = oldest;
            }
            return collected;
        },
        [fetchPage],
    );

    // SSE 重连后：把所有「已加载」tab 漏掉的新帖都补回来
    const syncNew = useCallback(async () => {
        const targets = FEED_TABS.filter((t) => feedsRef.current[t].sinceId !== null);
        await Promise.all(
            targets.map(async (target) => {
                const fromSinceId = feedsRef.current[target].sinceId;
                if (fromSinceId === null) return;
                try {
                    const page = await catchUp(target, fromSinceId);
                    if (page.length === 0) return;
                    patchFeed(target, (prev) => ({ live: mergeLive(prev.live, page) }));
                } catch {
                    // 补漏失败就算了，下次重连再试
                }
            }),
        );
    }, [catchUp, patchFeed]);

    // 批量把某条帖子映射更新（跨所有 tab）
    const mapAllFeeds = useCallback((id: string, updater: (post: Post) => Post) => {
        setFeeds((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const target of FEED_TABS) {
                const state = prev[target];
                if (!findPost(state.live, id) && !findPost(state.history, id)) continue;
                next[target] = {
                    ...state,
                    live: mapPost(state.live, id, updater),
                    history: mapPost(state.history, id, updater),
                };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, []);

    const removeAllFeeds = useCallback((id: string) => {
        setFeeds((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const target of FEED_TABS) {
                const state = prev[target];
                const live = removePost(state.live, id);
                const history = removePost(state.history, id);
                if (live !== state.live || history !== state.history) {
                    next[target] = { ...state, live, history };
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);

    const compose = useCallback(
        async (content: string) => {
            if (!session) throw new Error("请先登录");

            // 等后端返回后再显示：用返回的 id / uuid / uri / content 构造新帖
            const created = await postsApi.createNote({ content });

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
            // 自己的新帖是最新的，放进所有「已加载」tab 的 live
            setFeeds((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const target of FEED_TABS) {
                    const state = prev[target];
                    if (!state.loaded) continue;
                    if (state.live.some((p) => p.id === post.id)) continue;
                    next[target] = { ...state, live: [post, ...state.live] };
                    changed = true;
                }
                return changed ? next : prev;
            });
        },
        [session, currentUser],
    );

    const reply = useCallback(
        async (target: Post, content: string) => {
            if (!session) throw new Error("请先登录");
            const inReplyTo = target.uri || undefined;

            // 等后端返回后再显示：用返回的数据构造回复
            const created = await postsApi.createNote({ content, inReplyTo });

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
            mapAllFeeds(target.id, append);
        },
        [session, currentUser, mapAllFeeds],
    );

    const loadUserPosts = useCallback(
        async (username: string) => {
            if (!username) return;
            try {
                const { items } = await postsApi.fetchUserPosts(username, { limit: FEED_LIMIT });
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
        [rememberUser],
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
        [userPosts, userPostsMeta, rememberUser],
    );

    const getPost = useCallback(
        (id: string) => {
            for (const state of Object.values(feeds)) {
                const found = findPost(state.live, id) ?? findPost(state.history, id);
                if (found) return found;
            }
            for (const chain of Object.values(threads)) {
                const found = findPost(chain, id);
                if (found) return found;
            }
            return undefined;
        },
        [feeds, threads],
    );

    const getThread = useCallback((id: string) => threads[id], [threads]);

    const loadThread = useCallback(
        async (id: string) => {
            const { chain, replies } = await postsApi.fetchThread(id);
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
        [rememberUser],
    );

    const mutate = useCallback(
        (id: string, updater: (post: Post) => Post) => {
            mapAllFeeds(id, updater);
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
        },
        [mapAllFeeds],
    );

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
                if (willLike) await postsApi.likeNote(id);
                else await postsApi.unlikeNote(id);
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

    const applyRemoteNote = useCallback(
        (item: PostListItem) => {
            // 记住作者展示信息
            rememberAuthors([item], rememberUser);
            const post = fromListItem(item);

            setFeeds((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const target of FEED_TABS) {
                    const state = prev[target];
                    // 没加载过的 tab 等切过去再拉，不用现在塞
                    if (!state.loaded) continue;

                    // 这条帖子是否属于该 tab
                    const belongs =
                        target === "all" ||
                        (target === "local" && item.domain === session?.instance) ||
                        (target === "following" && (isFollowing(item.username) || item.username === session?.username));
                    if (!belongs) continue;

                    // 比 sinceId 旧的属于 history 段（GET 会拿到），不塞进 live
                    if (post.cursorId != null && state.sinceId != null && post.cursorId <= state.sinceId) continue;
                    if (state.live.some((p) => p.id === post.id)) continue;

                    next[target] = { ...state, live: [post, ...state.live] };
                    changed = true;
                }
                return changed ? next : prev;
            });
        },
        [session, isFollowing, rememberUser],
    );

    const deletePost = useCallback(
        async (post: Post) => {
            if (!session) throw new Error("请先登录");

            await postsApi.deleteNote(post.id);

            // 从时间线、线程、个人主页列表里就地移除
            removeAllFeeds(post.id);
            setThreads((prev) => {
                const next: Record<string, Post[]> = {};
                for (const [key, chain] of Object.entries(prev)) {
                    // 删掉这条帖子自己的线程缓存（详情页会变成“帖子不存在”）
                    if (key === post.id) continue;
                    next[key] = removePost(chain, post.id);
                }
                return next;
            });
            setUserPosts((prev) => {
                let next = prev;
                for (const [username, list] of Object.entries(prev)) {
                    const updated = removePost(list, post.id);
                    if (updated !== list) {
                        if (next === prev) next = { ...prev };
                        next[username] = updated;
                    }
                }
                return next;
            });
        },
        [session, removeAllFeeds],
    );

    const value = useMemo<TimelineValue>(
        () => ({
            posts,
            liveCount: active.live.length,
            loading: active.loading,
            hasMore: active.hasMore,
            loadingMore: active.loadingMore,
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
            deletePost,
            applyRemoteNote,
            syncNew,
        }),
        [
            posts,
            active,
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
            deletePost,
            applyRemoteNote,
            syncNew,
        ],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}
