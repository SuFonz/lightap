"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usersApi } from "@/web/lib/api";
import { useSession } from "@/web/stores/session-store";
import type { User } from "@/web/types";
import { DirectoryContext } from "./context";
import { GUEST, makeLocalUser, makeRemoteUser } from "./helpers";
import type { DirectoryValue, RememberUserInput } from "./types";

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
        (input: RememberUserInput) => {
            const { username, domain, displayName, avatarUrl } = input;
            if (!username) return;
            setUsers((prev) => {
                const existing = prev[username];
                if (existing) {
                    // 只补齐展示信息，不覆盖已有资料
                    return {
                        ...prev,
                        [username]: {
                            ...existing,
                            displayName: displayName || existing.displayName,
                            avatarUrl: avatarUrl || existing.avatarUrl,
                        },
                    };
                }
                const user = domain
                    ? makeRemoteUser(
                          {
                              username,
                              domain,
                              displayName: displayName || username,
                              avatarUrl: avatarUrl ?? "",
                              actorUrl: "",
                              originalUrl: "",
                              isFollowing: false,
                          },
                          instance,
                      )
                    : makeLocalUser(username, instance, { displayName: displayName || username, avatarUrl });
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
            const found = items.map((item) => makeRemoteUser(item, instance));
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
            if (!username || requested.current.has(username)) return;
            requested.current.add(username);
            try {
                // 只查后端本地数据库里的用户资料
                const profile = await usersApi.fetchProfile(username, session?.token);
                upsert([
                    {
                        username: profile.username,
                        displayName: profile.displayName,
                        avatarUrl: profile.avatarUrl || undefined,
                        domain: profile.domain,
                        instance: profile.instance,
                        actorUrl: profile.actorUrl,
                        bio: profile.bio,
                        postsCount: profile.postsCount,
                        followingCount: profile.followingCount,
                        followersCount: profile.followersCount,
                    },
                ]);
                // 用后端返回的 isFollowing 校准关注状态
                setFollowing((prev) => {
                    const next = new Set(prev);
                    if (profile.isFollowing) next.add(profile.username);
                    else next.delete(profile.username);
                    return next;
                });
            } catch {
                setMissing((prev) => new Set(prev).add(username));
            }
        },
        [session, upsert],
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
                        targetActorUrl: user.actorUrl,
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
