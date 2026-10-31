"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usersApi, postsApi } from "@/web/lib/api";
import { followListKey, postsKey } from "@/web/lib/user";
import { useDirectory } from "@/web/stores/directory";
import { useSession } from "@/web/stores/session-store";
import type { FeedTab, FollowDirection, FollowUser, Post, PostListItem } from "@/web/types";
import { TimelineContext } from "./context";
import { appendUnique, findPost, fromListItem, fromNoteItem, makePost, mapPost, removePost, rememberAuthors, sortByTimelineTime, upsertRealtime } from "./helpers";
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
    // 用户的「回复」列表：与帖子列表独立缓存、独立分页
    const [userReplies, setUserReplies] = useState<Record<string, Post[]>>({});
    const [userRepliesMeta, setUserRepliesMeta] = useState<Record<string, Pagination>>({});
    // 关注 / 粉丝列表
    const [followLists, setFollowLists] = useState<Record<string, FollowUser[]>>({});
    const [followListsMeta, setFollowListsMeta] = useState<Record<string, Pagination>>({});
    const [tab, setTab] = useState<FeedTab>("all");
    // 实时帖与历史帖的分界：历史帖 id <= sinceId，实时帖 id > sinceId
    const [sinceId, setSinceId] = useState<number | null>(null);

    const historyRef = useRef(history);
    historyRef.current = history;
    const sinceIdRef = useRef(sinceId);
    sinceIdRef.current = sinceId;

    /**
     * 账号隔离：换账号 / 登出时必须清空所有列表缓存。
     *
     * 原因：列表里带着「相对当前用户」的私有状态（boostedByMe、likedByMe），
     * 以及 following 这类只对特定账号成立的分区。不清的话：
     * - 换账号后 loadFeed 命中 `loaded` 缓存，直接显示上一个账号的数据，
     *   表现为「用另一个账号登录，转发按钮还是亮的」
     * - following tab 里会残留上一个账号的关注内容
     */
    const identity = session?.username ?? "";
    const prevIdentityRef = useRef(identity);
    useEffect(() => {
        if (prevIdentityRef.current === identity) return;
        prevIdentityRef.current = identity;

        setRealtime([]);
        setHistory({
            all: emptyHistory(),
            local: emptyHistory(),
            following: emptyHistory(),
        });
        setThreads({});
        setUserPosts({});
        setUserPostsMeta({});
        setUserReplies({});
        setUserRepliesMeta({});
        setFollowLists({});
        setFollowListsMeta({});
        setSinceId(null);
        setTab("all");
    }, [identity]);

    // 本站 host：登录用户用 session.instance，访客用当前浏览器 host（否则访客的「本地」tab 会全被过滤掉）
    const localHost = session?.instance || (typeof window === "undefined" ? "" : window.location.host);

    const active = history[tab];

    // 当前 tab 的实时帖：服务端标记的 tabs 含该 tab、且不在历史里（去重）
    const realtimeForTab = useMemo(() => {
        const historyIds = new Set(active.posts.map((p) => p.id));
        return realtime.filter((p) => (p.tabs?.includes(tab) ?? false) && !historyIds.has(p.id));
    }, [realtime, tab, active.posts]);

    // 展示列表：实时帖在前，历史在后，整体再按「展示时间」倒序。
    // 转发过的帖子用转发时间参与排序（所以会浮到最前），
    // 取消转发后 announcedAt 清空，自动回落到原帖时间。
    const posts = useMemo(
        () => sortByTimelineTime([...realtimeForTab, ...active.posts]),
        [realtimeForTab, active.posts],
    );

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
                // 自己的列表按本地用户缓存（key 不带 domain）
                const key = postsKey(currentUser.username, null);
                const list = prev[key];
                if (!list) return prev;
                return { ...prev, [key]: appendUnique([post], list) };
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
        async (username: string, domain?: string | null) => {
            if (!username) return;
            // 缓存键带上 domain：远程 admin 和本地 admin 是两个人，列表不能互相覆盖
            const key = postsKey(username, domain);
            try {
                const { items } = await postsApi.fetchUserPosts(username, { limit: FEED_LIMIT, domain });
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserPosts((prev) => ({ ...prev, [key]: page }));
                setUserPostsMeta((prev) => ({
                    ...prev,
                    [key]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
            } catch {
                setUserPosts((prev) => ({ ...prev, [key]: [] }));
                setUserPostsMeta((prev) => ({ ...prev, [key]: { hasMore: false, loadingMore: false } }));
            }
        },
        [rememberUser],
    );

    const loadMoreUserPosts = useCallback(
        async (username: string, domain?: string | null) => {
            const key = postsKey(username, domain);
            const list = userPosts[key];
            const meta = userPostsMeta[key];
            if (!list || !meta?.hasMore || meta.loadingMore) return;
            const last = list[list.length - 1];
            if (!last?.cursorId) return;

            setUserPostsMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: true } }));
            try {
                const { items } = await postsApi.fetchUserPosts(
                    username,
                    { limit: FEED_LIMIT, maxId: last.cursorId, domain },
                );
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserPosts((prev) => ({ ...prev, [key]: appendUnique(prev[key] ?? [], page) }));
                setUserPostsMeta((prev) => ({
                    ...prev,
                    [key]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
            } catch {
                setUserPostsMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: false } }));
            }
        },
        [userPosts, userPostsMeta, rememberUser],
    );

    /**
     * 用户的回复列表（「回复」标签页）。
     *
     * 与 loadUserPosts 结构相同，只是接口和缓存键不同。
     * 两个列表各自独立分页：翻「帖子」不会影响「回复」的游标。
     */
    const loadUserReplies = useCallback(
        async (username: string, domain?: string | null) => {
            if (!username) return;
            const key = postsKey(username, domain, "replies");
            try {
                const { items } = await postsApi.fetchUserReplies(username, { limit: FEED_LIMIT, domain });
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserReplies((prev) => ({ ...prev, [key]: page }));
                setUserRepliesMeta((prev) => ({
                    ...prev,
                    [key]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
            } catch {
                setUserReplies((prev) => ({ ...prev, [key]: [] }));
                setUserRepliesMeta((prev) => ({ ...prev, [key]: { hasMore: false, loadingMore: false } }));
            }
        },
        [rememberUser],
    );

    const loadMoreUserReplies = useCallback(
        async (username: string, domain?: string | null) => {
            const key = postsKey(username, domain, "replies");
            const list = userReplies[key];
            const meta = userRepliesMeta[key];
            if (!list || !meta?.hasMore || meta.loadingMore) return;
            const last = list[list.length - 1];
            if (!last?.cursorId) return;

            setUserRepliesMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: true } }));
            try {
                const { items } = await postsApi.fetchUserReplies(
                    username,
                    { limit: FEED_LIMIT, maxId: last.cursorId, domain },
                );
                rememberAuthors(items, rememberUser);
                const page = items.map(fromListItem);
                setUserReplies((prev) => ({ ...prev, [key]: appendUnique(prev[key] ?? [], page) }));
                setUserRepliesMeta((prev) => ({
                    ...prev,
                    [key]: { hasMore: page.length === FEED_LIMIT, loadingMore: false },
                }));
            } catch {
                setUserRepliesMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: false } }));
            }
        },
        [userReplies, userRepliesMeta, rememberUser],
    );

    /** 关注 / 粉丝列表：首次加载 */
    const loadFollowList = useCallback(
        async (
            username: string,
            domain: string | null | undefined,
            direction: FollowDirection,
        ) => {
            if (!username) return;
            const key = followListKey(username, domain, direction);
            try {
                const { items, hasMore } = await usersApi.fetchFollowList(username, direction, {
                    limit: FEED_LIMIT,
                    domain,
                });
                setFollowLists((prev) => ({ ...prev, [key]: items }));
                setFollowListsMeta((prev) => ({ ...prev, [key]: { hasMore, loadingMore: false } }));
            } catch {
                setFollowLists((prev) => ({ ...prev, [key]: [] }));
                setFollowListsMeta((prev) => ({ ...prev, [key]: { hasMore: false, loadingMore: false } }));
            }
        },
        [],
    );

    /** 关注 / 粉丝列表：翻页。游标取最后一项的 cursorId（follows.id） */
    const loadMoreFollowList = useCallback(
        async (
            username: string,
            domain: string | null | undefined,
            direction: FollowDirection,
        ) => {
            const key = followListKey(username, domain, direction);
            const list = followLists[key];
            const meta = followListsMeta[key];
            if (!list || !meta?.hasMore || meta.loadingMore) return;
            const last = list[list.length - 1];
            if (!last?.cursorId) return;

            setFollowListsMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: true } }));
            try {
                const { items, hasMore } = await usersApi.fetchFollowList(username, direction, {
                    limit: FEED_LIMIT,
                    maxId: last.cursorId,
                    domain,
                });
                setFollowLists((prev) => {
                    // 按 actorUrl 去重：翻页边界上偶尔会重复
                    const seen = new Set((prev[key] ?? []).map((u) => u.actorUrl));
                    return { ...prev, [key]: [...(prev[key] ?? []), ...items.filter((u) => !seen.has(u.actorUrl))] };
                });
                setFollowListsMeta((prev) => ({ ...prev, [key]: { hasMore, loadingMore: false } }));
            } catch {
                setFollowListsMeta((prev) => ({ ...prev, [key]: { ...prev[key], loadingMore: false } }));
            }
        },
        [followLists, followListsMeta],
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

    /**
     * 转发 / 取消转发（乐观更新，失败自动回滚）。
     *
     * 转发会改变帖子在时间线里的位置，所以乐观更新里要一并处理时间：
     * - 转发：把 `announcedAt` 设为当前时间，帖子立刻浮到最前（不等 SSE）
     * - 取消：清掉 `announcedAt`，帖子立刻回到原帖时间对应的位置
     * 这样按钮点击后排序立刻正确，SSE 到达时再校正一次即可。
     */
    const toggleBoost = useCallback(
        async (post: Post) => {
            if (!session) throw new Error("请先登录");

            const willBoost = !post.boostedByMe;
            const id = post.id;
            const now = new Date().toISOString();

            mutate(id, (item) => ({
                ...item,
                boostedByMe: willBoost,
                boosts: item.boosts + (willBoost ? 1 : -1),
                // 时间：转发算「此刻」，取消则回落到原帖时间
                announcedAt: willBoost ? now : undefined,
            }));

            try {
                if (willBoost) await postsApi.announceNote(id);
                else await postsApi.unannounceNote(id);
            } catch (error) {
                // 失败回滚
                mutate(id, (item) => ({
                    ...item,
                    boostedByMe: !willBoost,
                    boosts: item.boosts + (willBoost ? -1 : 1),
                    announcedAt: willBoost ? post.announcedAt : now,
                }));
                throw error;
            }
        },
        [session, mutate],
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

    const applyRemoteLike = useCallback(
        (payload: { noteUuid: string }) => {
            mutate(payload.noteUuid, (post) => ({ ...post, likes: post.likes + 1 }));
        },
        [mutate],
    );

    /**
     * 收到实时转发（SSE announce.created）。
     *
     * 与 note.created 的区别：帖子本身可能早就在时间线里了，
     * 这里不是「插入新帖」，而是「给已有帖打上转发标记」。
     *
     * 关键点：SSE 送来的是 `fromListItem` 的结果，它**不含 `tabs` 字段**
     * （tabs 只在 upsertRealtime 里补）。所以不能把整条替换进列表——
     * 那样新对象没有 tabs，下一帧就会被 realtimeForTab 的
     * `p.tabs?.includes(tab)` 过滤掉，表现为「转发第二条后它自己消失了」。
     * 正确做法：沿用已有对象的 tabs，只覆盖转发相关字段。
     */
    const applyRemoteAnnounce = useCallback(
        (item: PostListItem) => {
            rememberAuthors([item], rememberUser);
            const post = fromListItem(item);
            if (!post.announcer) return;

            const tabs = tabsForPost(post, localHost);
            const existing = findPost(
                [...realtime, ...Object.values(history).flatMap((state) => state.posts)],
                post.id,
            );

            if (existing) {
                // 已有这条帖子：更新转发标记（保留 tabs 等本地派生字段），并把它提到最前
                setRealtime((prev) => {
                    const target = prev.find((p) => p.id === post.id);
                    if (!target) {
                        // 只在历史里：给历史那条打标记即可，不重复插入实时区
                        return prev;
                    }
                    const merged: Post = {
                        ...target,
                        // 转发相关字段用新数据。
                        // 注意 boostedByMe / likedByMe 都**不覆盖**：SSE 是广播，
                        // 载荷里的 boosted / liked 是按「无 viewer」算出来的（恒 false），
                        // 覆盖会把本人已点亮的按钮冲回未点亮状态。
                        // 表现为「别人转发的帖子，我点过的赞又变回未点赞」。
                        // 本人的点赞 / 转发状态只由 toggleLike / toggleBoost 的乐观更新
                        // 与后续 fetch 决定，这里只更新公共计数。
                        boosts: post.boosts,
                        announcer: post.announcer,
                        // 转发时间：排序键，让它按「转发那一刻」浮到最前
                        announcedAt: post.announcedAt,
                        likes: post.likes,
                        repliesCount: post.repliesCount,
                        attachment: post.attachment,
                        // 沿用已有的 tabs（这是它能留在列表里的关键）
                        tabs: target.tabs ?? tabs,
                    };
                    return mapPost(prev, post.id, () => merged);
                });

                // 历史区里的那条：补上转发标记**和转发时间**。
                //
                // announcedAt 必须一起写：它是排序键。绝大多数帖子在历史区，
                // 只写 announcer 不写 announcedAt 的话，排序仍按原帖 createdAt，
                // 表现为「别人转发了我这边排序不变」。
                setHistory((prev) => {
                    let changed = false;
                    const next = { ...prev };
                    for (const target of FEED_TABS) {
                        const state = prev[target];
                        if (!findPost(state.posts, post.id)) continue;
                        next[target] = {
                            ...state,
                            posts: mapPost(state.posts, post.id, (p) => ({
                                ...p,
                                announcer: post.announcer,
                                announcedAt: post.announcedAt,
                                boosts: post.boosts,
                            })),
                        };
                        changed = true;
                    }
                    return changed ? next : prev;
                });
                return;
            }

            // 不在当前列表：按实时帖插入（upsertRealtime 会补上 tabs）
            setRealtime((prev) => upsertRealtime(prev, post, tabs));
        },
        [history, localHost, realtime, rememberUser],
    );

    /**
     * 收到实时取消转发：撤掉标记（帖子本身保留在时间线里）。
     *
     * 两种来源要分开处理：
     * - 别人取消：本地没减过计数，这里减 1
     * - 自己取消：`toggleBoost` 已经乐观减过 1，这里只清标记，不再减计数
     *   （否则会减成 -2，被 Math.max 兜住后计数直接归零，看起来像掉了两次）
     */
    const applyRemoteAnnounceRemoved = useCallback(
        (payload: { noteUuid: string; actorUsername?: string }) => {
            const isSelf = !!payload.actorUsername && payload.actorUsername === session?.username;
            mutate(payload.noteUuid, (post) => {
                if (!post.announcer) return post;
                return {
                    ...post,
                    announcer: undefined,
                    // 清掉转发时间：排序会自动回落到原帖 createdAt，
                    // 帖子于是回到它原本的时间线位置。
                    announcedAt: undefined,
                    boosts: isSelf ? post.boosts : Math.max(0, post.boosts - 1),
                };
            });
        },
        [mutate, session],
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
            // 回复列表同理：删掉的帖子也可能出现在「回复」标签页里
            setUserReplies((prev) => {
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
            userReplies,
            userRepliesMeta,
            loadUserReplies,
            loadMoreUserReplies,
            followLists,
            followListsMeta,
            loadFollowList,
            loadMoreFollowList,
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
            applyRemoteLike,
            applyRemoteAnnounce,
            applyRemoteAnnounceRemoved,
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
            userReplies,
            userRepliesMeta,
            loadUserReplies,
            loadMoreUserReplies,
            followLists,
            followListsMeta,
            loadFollowList,
            loadMoreFollowList,
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
            applyRemoteLike,
            applyRemoteAnnounce,
            applyRemoteAnnounceRemoved,
        ],
    );

    return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}
