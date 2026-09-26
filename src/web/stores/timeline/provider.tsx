"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { postsApi } from "@/web/lib/api";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, Post, PostListItem } from "@/web/types";
import { TimelineContext } from "./context";
import { appendUnique, findPost, fromListItem, fromNoteItem, makePost, mapPost, removePost, rememberAuthors, upsertRealtime } from "./helpers";
import type { Pagination, TimelineValue } from "./types";

const FEED_LIMIT = 30;
/** 重连补漏时最多拉多少条 */
const REALTIME_SYNC_LIMIT = 30;
const FEED_TABS: FeedTab[] = ["all", "local", "following"];

interface HistoryState {
    /** GET 分页的历史，新的在前 */
    posts: Post[];
    /** 是否已加载过（切 tab 走缓存） */
    loaded: boolean;
    loading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
}

function emptyHistory(): HistoryState {
    return { posts: [], loaded: false, loading: false, hasMore: false, loadingMore: false };
}

/** 一条新帖（对某个接收者）属于哪些 tab：all 总是；本地看 domain；following 由服务端定向推送决定 */
function tabsForPost(post: Post, localHost: string, following = false): FeedTab[] {
    const tabs: FeedTab[] = ["all"];
    if (post.domain === localHost) tabs.push("local");
    if (following) tabs.push("following");
    return tabs;
}

export function TimelineProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const { currentUser, rememberUser } = useDirectory();

    // 实时帖子：所有 tab 共用一个数组，展示时按 tab 过滤
    const [realtime, setRealtime] = useState<Post[]>([]);
    // 历史帖子：每个 tab 各一份（可缓存）
    const [history, setHistory] = useState<Record<FeedTab, HistoryState>>(() => ({
        all: emptyHistory(),
        local: emptyHistory(),
        following: emptyHistory(),
    }));
    const [threads, setThreads] = useState<Record<string, Post[]>>({});
    const [userPosts, setUserPosts] = useState<Record<string, Post[]>>({});
    const [userPostsMeta, setUserPostsMeta] = useState<Record<string, Pagination>>({});
    const [tab, setTab] = useState<FeedTab>("all");
    // 实时帖与历史帖的分界：历史帖 id <= sinceId，实时帖 id > sinceId
    const [sinceId, setSinceId] = useState<number | null>(null);

    const historyRef = useRef(history);
    historyRef.current = history;
    const sinceIdRef = useRef(sinceId);
    sinceIdRef.current = sinceId;

    // 本站 host：登录用户用 session.instance，访客用当前浏览器 host（否则访客的「本地」tab 会全被过滤掉）
    const localHost = session?.instance || (typeof window === "undefined" ? "" : window.location.host);

    const active = history[tab];

    // 当前 tab 的实时帖：服务端标记的 tabs 含该 tab、且不在历史里（去重）
    const realtimeForTab = useMemo(() => {
        const historyIds = new Set(active.posts.map((p) => p.id));
        return realtime.filter((p) => (p.tabs?.includes(tab) ?? false) && !historyIds.has(p.id));
    }, [realtime, tab, active.posts]);

    const posts = useMemo(() => [...realtimeForTab, ...active.posts], [realtimeForTab, active.posts]);

    const patchHistory = useCallback(
        (target: FeedTab, patch: Partial<HistoryState> | ((prev: HistoryState) => Partial<HistoryState>)) => {
            setHistory((prev) => {
                const current = prev[target];
                const next = typeof patch === "function" ? patch(current) : patch;
                return { ...prev, [target]: { ...current, ...next } };
            });
        },
        [],
    );

    const fetchPage = useCallback(
        async (target: FeedTab, opts: { maxId?: number } = {}) => {
            const { items } = await postsApi.fetchFeed(target, { limit: FEED_LIMIT, ...opts });
            rememberAuthors(items, rememberUser);
            return items.map(fromListItem);
        },
        [rememberUser],
    );

    const loadFeed = useCallback(
        async (target: FeedTab) => {
            setTab(target);
            // 已加载过的 tab 走缓存，不再发 GET
            if (historyRef.current[target].loaded) return;

            patchHistory(target, { loading: true, hasMore: false, loadingMore: false });
            try {
                let boundary = sinceIdRef.current;
                if (boundary === null) {
                    // 首次先用 type=all 建立全局边界（all 是超集，最新 id 即全局最新）
                    const allPage = await fetchPage("all");
                    boundary = allPage[0]?.cursorId ?? null;
                    setSinceId(boundary);
                    // 边界确立后，把之前收到、但已落到历史区（<= boundary）的实时帖剔除
                    if (boundary !== null) {
                        const top = boundary;
                        setRealtime((prev) => prev.filter((p) => p.cursorId != null && p.cursorId > top));
                    }
                    if (target === "all") {
                        patchHistory(target, {
                            posts: allPage,
                            loaded: true,
                            loading: false,
                            hasMore: allPage.length === FEED_LIMIT,
                            loadingMore: false,
                        });
                        return;
                    }
                }

                // 从边界往下取该 tab 的历史（id <= sinceId）
                const page = boundary === null
                    ? await fetchPage(target)
                    : await fetchPage(target, { maxId: boundary + 1 });
                patchHistory(target, {
                    posts: page,
                    loaded: true,
                    loading: false,
                    hasMore: page.length === FEED_LIMIT,
                    loadingMore: false,
                });
            } catch {
                patchHistory(target, {
                    posts: [],
                    loaded: true,
                    loading: false,
                    hasMore: false,
                    loadingMore: false,
                });
            }
        },
        [fetchPage, patchHistory],
    );

    const loadMore = useCallback(async () => {
        const state = historyRef.current[tab];
        if (state.loading || state.loadingMore || !state.hasMore) return;
        const last = state.posts[state.posts.length - 1];
        if (!last?.cursorId) return;

        patchHistory(tab, { loadingMore: true });
        try {
            const page = await fetchPage(tab, { maxId: last.cursorId });
            patchHistory(tab, (prev) => ({
                posts: appendUnique(prev.posts, page),
                hasMore: page.length === FEED_LIMIT,
                loadingMore: false,
            }));
        } catch {
            patchHistory(tab, { loadingMore: false });
        }
    }, [tab, fetchPage, patchHistory]);

    // 重连补漏：拉最新的最多 30 条（all + following），合并进实时数组并去重、标 tabs
    const syncNew = useCallback(async () => {
        const boundary = sinceIdRef.current;
        const accept = (p: Post) => boundary === null || (p.cursorId != null && p.cursorId > boundary);
        try {
            const { items: allItems } = await postsApi.fetchFeed("all", { limit: REALTIME_SYNC_LIMIT });
            rememberAuthors(allItems, rememberUser);
            setRealtime((prev) => {
                let next = prev;
                for (const post of allItems.map(fromListItem).filter(accept)) {
                    next = upsertRealtime(next, post, tabsForPost(post, localHost));
                }
                return next;
            });

            if (session) {
                const { items: followingItems } = await postsApi.fetchFeed("following", { limit: REALTIME_SYNC_LIMIT });
                rememberAuthors(followingItems, rememberUser);
                setRealtime((prev) => {
                    let next = prev;
                    for (const post of followingItems.map(fromListItem).filter(accept)) {
                        next = upsertRealtime(next, post, tabsForPost(post, localHost, true));
                    }
                    return next;
                });
            }
        } catch {
            // 补漏失败就算了，下次重连再试
        }
    }, [session, localHost, rememberUser]);

    // 跨「实时 + 所有 tab 的历史」更新一条帖子
    const mapAll = useCallback((id: string, updater: (post: Post) => Post) => {
        setRealtime((prev) => mapPost(prev, id, updater));
        setHistory((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const target of FEED_TABS) {
                const state = prev[target];
                if (!findPost(state.posts, id)) continue;
                next[target] = { ...state, posts: mapPost(state.posts, id, updater) };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, []);

    const removeAll = useCallback((id: string) => {
        setRealtime((prev) => removePost(prev, id));
        setHistory((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const target of FEED_TABS) {
                const state = prev[target];
                const updated = removePost(state.posts, id);
                if (updated !== state.posts) {
                    next[target] = { ...state, posts: updated };
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);

    const compose = useCallback(
        async (content: string) => {
            if (!session) throw new Error("请先登录");

            const created = await postsApi.createNote({ content });

            const post = makePost(created.uuid, currentUser.username, created.content, new Date().toISOString());
            post.uri = created.uri;
            post.cursorId = created.id;
            post.domain = session.instance;
            post.likedByMe = created.liked;
            post.likes = created.likeCount;

            // 自己的主页列表（若已加载）
            setUserPosts((prev) => {
                const list = prev[currentUser.username];
                if (!list) return prev;
                return { ...prev, [currentUser.username]: appendUnique([post], list) };
            });
            // 自己的新帖：all / local / following 都算
            setRealtime((prev) => upsertRealtime(prev, post, ["all", "local", "following"]));
        },
        [session, currentUser],
    );

    const reply = useCallback(
        async (target: Post, content: string) => {
            if (!session) throw new Error("请先登录");
            const inReplyTo = target.uri || undefined;

            const created = await postsApi.createNote({ content, inReplyTo });

            const newReply = makePost(created.uuid, currentUser.username, created.content, new Date().toISOString(), inReplyTo);
            newReply.uri = created.uri;
            newReply.cursorId = created.id;

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
            mapAll(target.id, append);
        },
        [session, currentUser, mapAll],
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
            const inRealtime = findPost(realtime, id);
            if (inRealtime) return inRealtime;
            for (const state of Object.values(history)) {
                const found = findPost(state.posts, id);
                if (found) return found;
            }
            for (const chain of Object.values(threads)) {
                const found = findPost(chain, id);
                if (found) return found;
            }
            return undefined;
        },
        [realtime, history, threads],
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
            mapAll(id, updater);
            setThreads((prev) => {
                const next: Record<string, Post[]> = {};
                for (const [key, chain] of Object.entries(prev)) next[key] = mapPost(chain, id, updater);
                return next;
            });
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
        [mapAll],
    );

    const toggleLike = useCallback(
        async (post: Post) => {
            if (!session) throw new Error("请先登录");

            const id = post.id;
            const willLike = !post.likedByMe;

            mutate(id, (item) => ({
                ...item,
                likedByMe: willLike,
                likes: item.likes + (willLike ? 1 : -1),
            }));

            try {
                if (willLike) await postsApi.likeNote(id);
                else await postsApi.unlikeNote(id);
            } catch (error) {
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
            rememberAuthors([item], rememberUser);
            const post = fromListItem(item);
            // 只收「边界之上」（更新的）实时帖；边界之下属于历史区
            const boundary = sinceIdRef.current;
            if (boundary !== null && post.cursorId != null && post.cursorId <= boundary) return;
            // 服务端广播的：all（作者是本站的话再带 local）
            setRealtime((prev) => upsertRealtime(prev, post, tabsForPost(post, localHost)));
        },
        [localHost, rememberUser],
    );

    const applyFollowingNote = useCallback(
        (item: PostListItem) => {
            rememberAuthors([item], rememberUser);
            const post = fromListItem(item);
            const boundary = sinceIdRef.current;
            if (boundary !== null && post.cursorId != null && post.cursorId <= boundary) return;
            // 服务端定向推送的「已关注」：再带上 following
            setRealtime((prev) => upsertRealtime(prev, post, tabsForPost(post, localHost, true)));
        },
        [localHost, rememberUser],
    );

    const applyRemoteReply = useCallback(
        (payload: { parentUuid: string; actorUsername?: string }) => {
            // 自己的回复本地已经 +1，避免重复
            if (payload.actorUsername && payload.actorUsername === session?.username) return;
            mutate(payload.parentUuid, (post) => ({ ...post, repliesCount: post.repliesCount + 1 }));
        },
        [session, mutate],
    );

    const deletePost = useCallback(
        async (post: Post) => {
            if (!session) throw new Error("请先登录");

            await postsApi.deleteNote(post.id);

            removeAll(post.id);
            setThreads((prev) => {
                const next: Record<string, Post[]> = {};
                for (const [key, chain] of Object.entries(prev)) {
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
        [session, removeAll],
    );

    const value = useMemo<TimelineValue>(
        () => ({
            posts,
            liveCount: realtimeForTab.length,
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
            applyFollowingNote,
            syncNew,
            applyRemoteReply,
        }),
        [
            posts,
            realtimeForTab,
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
            applyFollowingNote,
            syncNew,
            applyRemoteReply,
        ],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}
