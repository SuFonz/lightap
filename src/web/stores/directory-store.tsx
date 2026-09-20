"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { usersApi } from "@/web/lib/api";
import { useSession } from "@/web/stores/session-store";
import type { SearchUserItem, User } from "@/web/types";

const GUEST: User = {
    username: "",
    displayName: "游客",
    domain: null,
    instance: "",
    actorUrl: "",
    online: false,
    bio: "",
    postsCount: 0,
    following: 0,
    followers: 0,
};

function makeLocalUser(username: string, instance: string, patch?: Partial<User>): User {
    return {
        username,
        displayName: username,
        domain: null,
        instance,
        actorUrl: instance ? `https://${instance}/users/${username}` : "",
        online: true,
        bio: "",
        postsCount: 0,
        following: 0,
        followers: 0,
        ...patch,
    };
}

function makeRemoteUser(item: SearchUserItem): User {
    return {
        username: item.username,
        displayName: item.displayName || item.username,
        avatarUrl: item.avatarUrl || undefined,
        domain: item.domain,
        instance: item.domain ?? "",
        actorUrl: item.actorUrl,
        online: false,
        bio: "",
        postsCount: 0,
        following: 0,
        followers: 0,
    };
}

interface DirectoryValue {
    currentUser: User;
    getUser: (username: string) => User | undefined;
    rememberUser: (username: string, domain?: string | null) => void;
    search: (query: string) => Promise<User[]>;
    loadProfile: (username: string) => Promise<void>;
    isProfileMissing: (username: string) => boolean;
    isFollowing: (username: string) => boolean;
    toggleFollow: (user: User) => Promise<void>;
    updateProfile: (patch: Partial<Pick<User, "displayName" | "bio" | "avatarUrl">>) => Promise<void>;
}

const DirectoryContext = createContext<DirectoryValue | null>(null);

export function DirectoryProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    const [users, setUsers] = useState<Record<string, User>>({});
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [missing, setMissing] = useState<Set<string>>(new Set());
    const requested = useRef<Set<string>>(new Set());

    const instance = session?.instance ?? "";

    // 切换账号时重置与登录态绑定的本地状态
    useEffect(() => {
        setFollowing(new Set());
        setMissing(new Set());
        requested.current = new Set();
    }, [session?.username]);

    const upsert = useCallback((items: User[]) => {
        if (items.length === 0) return;
        setUsers((prev) => {
            const next = { ...prev };
            for (const item of items) next[item.username] = { ...prev[item.username], ...item };
            return next;
        });
    }, []);

    const currentUser = useMemo(
        () => (session ? users[session.username] ?? makeLocalUser(session.username, session.instance) : GUEST),
        [session, users],
    );

    const getUser = useCallback(
        (username: string) => {
            if (session && username === session.username) return currentUser;
            return users[username];
        },
        [session, users, currentUser],
    );

    const rememberUser = useCallback(
        (username: string, domain?: string | null) => {
            if (!username) return;
            setUsers((prev) => {
                if (prev[username]) return prev;
                const user = domain
                    ? makeRemoteUser({ username, domain, displayName: username, avatarUrl: "", actorUrl: "", originalUrl: "", isFollowing: false })
                    : makeLocalUser(username, instance);
                return { ...prev, [username]: user };
            });
        },
        [instance],
    );

    const search = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return [];
            // 后端要求 acct 形式，这里自动补全前导 @
            const term = q.startsWith("@") ? q : `@${q}`;
            const { items } = await usersApi.search(term, session?.token);
            const found = items.map(makeRemoteUser);
            upsert(found);
            // 用后端返回的 isFollowing 校准关注状态，让关注按钮显示正确
            setFollowing((prev) => {
                const next = new Set(prev);
                for (const item of items) {
                    if (item.isFollowing) next.add(item.username);
                    else next.delete(item.username);
                }
                return next;
            });
            return found;
        },
        [session, upsert],
    );

    const loadProfile = useCallback(
        async (username: string) => {
            if (!username || username === session?.username) return;
            if (users[username] || requested.current.has(username)) return;
            requested.current.add(username);
            try {
                // 后端目前只支持按完整 handle 搜索远端账号
                const { items } = await usersApi.search(`@${username}`, session?.token);
                const match = items.find((item) => item.username === username);
                if (match) upsert([makeRemoteUser(match)]);
                else setMissing((prev) => new Set(prev).add(username));
            } catch {
                setMissing((prev) => new Set(prev).add(username));
            }
        },
        [users, session, upsert],
    );

    const isProfileMissing = useCallback((username: string) => missing.has(username), [missing]);

    const isFollowing = useCallback((username: string) => following.has(username), [following]);

    const toggleFollow = useCallback(
        async (user: User) => {
            if (!session) throw new Error("请先登录");
            const wasFollowing = following.has(user.username);

            // 乐观更新，失败后回滚
            setFollowing((prev) => {
                const next = new Set(prev);
                if (wasFollowing) next.delete(user.username);
                else next.add(user.username);
                return next;
            });

            try {
                if (wasFollowing) {
                    await usersApi.unfollow(session.token, {
                        username: user.username,
                        domain: user.domain ?? session.instance,
                    });
                } else {
                    await usersApi.follow(session.token, {
                        username: user.username,
                        domain: user.domain ?? session.instance,
                        targetActorUrl: user.actorUrl,
                    });
                }
            } catch (error) {
                setFollowing((prev) => {
                    const next = new Set(prev);
                    if (wasFollowing) next.add(user.username);
                    else next.delete(user.username);
                    return next;
                });
                throw error;
            }
        },
        [session, following],
    );

    const updateProfile = useCallback(
        async (patch: Partial<Pick<User, "displayName" | "bio" | "avatarUrl">>) => {
            if (!session) return;
            // 后端暂无资料编辑接口，先在本地生效
            setUsers((prev) => ({
                ...prev,
                [session.username]: {
                    ...(prev[session.username] ?? makeLocalUser(session.username, session.instance)),
                    ...patch,
                },
            }));
        },
        [session],
    );

    const value = useMemo<DirectoryValue>(
        () => ({
            currentUser,
            getUser,
            rememberUser,
            search,
            loadProfile,
            isProfileMissing,
            isFollowing,
            toggleFollow,
            updateProfile,
        }),
        [currentUser, getUser, rememberUser, search, loadProfile, isProfileMissing, isFollowing, toggleFollow, updateProfile],
    );

    return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
}

export function useDirectory(): DirectoryValue {
    const ctx = useContext(DirectoryContext);
    if (!ctx) throw new Error("useDirectory must be used within DirectoryProvider");
    return ctx;
}
