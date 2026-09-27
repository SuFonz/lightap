"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usersApi } from "@/web/lib/api";
import { userKey } from "@/web/lib/user";
import { useSession } from "@/web/stores/session-store";
import type { User } from "@/web/types";
import { DirectoryContext } from "./context";
import { GUEST, makeLocalUser, makeRemoteUser } from "./helpers";
import type { DirectoryValue, RememberUserInput } from "./types";

export function DirectoryProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
    // 按 `username@domain` 索引，本地 / 远程同名不互相覆盖
    const [users, setUsers] = useState<Record<string, User>>({});
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [missing, setMissing] = useState<Set<string>>(new Set());
    const requested = useRef<Set<string>>(new Set());

    const instance = session?.instance ?? "";
    const keyOf = useCallback(
        (username: string, domain?: string | null) => `${username}@${domain ?? instance}`,
        [instance],
    );

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
            for (const item of items) {
                const key = userKey(item);
                next[key] = { ...prev[key], ...item };
            }
            return next;
        });
    }, []);

    const currentUser = useMemo(
        () => (session ? users[`${session.username}@${session.instance}`] ?? makeLocalUser(session.username, session.instance) : GUEST),
        [session, users],
    );

    const getUser = useCallback(
        (username: string, domain?: string | null) => {
            if (session && username === session.username && (domain == null || domain === session.instance)) {
                return currentUser;
            }
            return users[keyOf(username, domain)];
        },
        [session, users, currentUser, keyOf],
    );

    const rememberUser = useCallback(
        (input: RememberUserInput) => {
            const { username, domain, displayName, avatarUrl } = input;
            if (!username) return;
            const key = keyOf(username, domain);
            setUsers((prev) => {
                const existing = prev[key];
                if (existing) {
                    // 只补齐展示信息，不覆盖已有资料
                    return {
                        ...prev,
                        [key]: {
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
                return { ...prev, [key]: user };
            });
        },
        [instance, keyOf],
    );

    const search = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return [];
            // 后端要求 acct 形式，这里自动补全前导 @
            const term = q.startsWith("@") ? q : `@${q}`;
            const { items } = await usersApi.search(term);
            const found = items.map((item) => makeRemoteUser(item, instance));
            upsert(found);
            // 用后端返回的 isFollowing 校准关注状态，让关注按钮显示正确
            setFollowing((prev) => {
                const next = new Set(prev);
                for (const item of items) {
                    const key = keyOf(item.username, item.domain);
                    if (item.isFollowing) next.add(key);
                    else next.delete(key);
                }
                return next;
            });
            return found;
        },
        [instance, upsert, keyOf],
    );

    const loadProfile = useCallback(
        async (username: string, domain?: string | null) => {
            if (!username) return;
            const key = keyOf(username, domain);
            if (requested.current.has(key)) return;
            requested.current.add(key);
            try {
                const profile = await usersApi.fetchProfile(username, domain ?? undefined);
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
                const followingKey = `${profile.username}@${profile.domain ?? profile.instance}`;
                setFollowing((prev) => {
                    const next = new Set(prev);
                    if (profile.isFollowing) next.add(followingKey);
                    else next.delete(followingKey);
                    return next;
                });
            } catch {
                setMissing((prev) => new Set(prev).add(key));
            }
        },
        [upsert, keyOf],
    );

    const isProfileMissing = useCallback(
        (username: string, domain?: string | null) => missing.has(keyOf(username, domain)),
        [missing, keyOf],
    );

    const isFollowing = useCallback((user: User) => following.has(userKey(user)), [following]);

    const toggleFollow = useCallback(
        async (user: User) => {
            if (!session) throw new Error("请先登录");
            const key = userKey(user);
            const wasFollowing = following.has(key);

            // 乐观更新，失败后回滚
            setFollowing((prev) => {
                const next = new Set(prev);
                if (wasFollowing) next.delete(key);
                else next.add(key);
                return next;
            });

            try {
                if (wasFollowing) {
                    await usersApi.unfollow({
                        username: user.username,
                        domain: user.domain ?? session.instance,
                        targetActorUrl: user.actorUrl,
                    });
                } else {
                    await usersApi.follow({
                        username: user.username,
                        domain: user.domain ?? session.instance,
                        targetActorUrl: user.actorUrl,
                    });
                }
            } catch (error) {
                setFollowing((prev) => {
                    const next = new Set(prev);
                    if (wasFollowing) next.add(key);
                    else next.delete(key);
                    return next;
                });
                throw error;
            }
        },
        [session, following],
    );

    const updateProfile = useCallback(
        async (patch: Partial<Pick<User, "displayName" | "bio">>) => {
            if (!session) throw new Error("请先登录");
            const previous = currentUser;

            // 乐观更新
            upsert([{ ...currentUser, ...patch }]);

            try {
                const updated = await usersApi.updateProfile({
                    displayName: patch.displayName,
                    bio: patch.bio,
                });
                // 用服务端返回值校准
                upsert([{
                    ...currentUser,
                    displayName: updated.displayName,
                    bio: updated.bio,
                }]);
            } catch (error) {
                // 失败回滚
                upsert([previous]);
                throw error;
            }
        },
        [session, currentUser, upsert],
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
