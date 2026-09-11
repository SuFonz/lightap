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
import { useAuthStore } from "./auth-store";
import * as api from "@/lib/client/api";
import type { ProfilePatch, User, UserProfile } from "@/lib/types/http";

interface UserStoreValue {
    users: User[];
    currentUser: User;
    getUser: (username: string) => User | undefined;
    isProfileMissing: (username: string) => boolean;
    /** 从服务端拉取并缓存真实资料（演示用户会得到 404，走种子数据兜底） */
    loadProfile: (username: string) => Promise<void>;
    isFollowing: (username: string) => boolean;
    toggleFollow: (user: User) => Promise<void>;
    updateProfile: (patch: ProfilePatch) => Promise<void>;
    incrementPostsCount: (username: string, delta: number) => void;
}

const UserStoreContext = createContext<UserStoreValue | null>(null);

const LOCAL_INSTANCE = "lightap.social";

function toFallbackUser(username: string): User {
    return {
        username,
        displayName: username,
        bio: "",
        instance: LOCAL_INSTANCE,
        followers: 0,
        following: 0,
        postsCount: 0,
        online: true,
    };
}

function toUser(profile: UserProfile): User {
    return {
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl ?? undefined,
        instance: profile.instance ?? LOCAL_INSTANCE,
        actorUrl: profile.actorUrl ?? undefined,
        followers: profile.followers,
        following: profile.followingCount,
        postsCount: profile.postsCount,
        online: true,
    };
}

export function UserStoreProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, username: sessionUsername, token } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<Record<string, User>>({});
    const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set());
    const [followingSet, setFollowingSet] = useState<Set<string>>(
        () => new Set(),
    );

    const activeUsername =
        isAuthenticated && sessionUsername ? sessionUsername : "";

    const currentUser = useMemo(
        () =>
            profiles[activeUsername] ??
            users.find((u) => u.username === activeUsername) ??
            toFallbackUser(activeUsername),
        [profiles, users, activeUsername],
    );

    // 用 ref 让 loadProfile 保持引用稳定，供页面 effect 使用
    const profilesRef = useRef(profiles);
    profilesRef.current = profiles;
    const missingRef = useRef(missing);
    missingRef.current = missing;

    const loadProfile = useCallback(async (username: string) => {
        if (!username) return;
        if (profilesRef.current[username] || missingRef.current.has(username)) return;

        try {
            const profile = await api.fetchUserProfile(username);
            if (profile) {
                setProfiles((prev) =>
                    prev[username] ? prev : { ...prev, [username]: toUser(profile) },
                );
            } else {
                setMissing((prev) => {
                    if (prev.has(username)) return prev;
                    const next = new Set(prev);
                    next.add(username);
                    return next;
                });
            }
        } catch {
            // 网络异常时保留现状，下次进入页面重试
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && sessionUsername) {
            void loadProfile(sessionUsername);
        }
    }, [isAuthenticated, sessionUsername, loadProfile]);

    const getUser = useCallback(
        (username: string) =>
            profiles[username] ?? users.find((u) => u.username === username),
        [profiles, users],
    );

    const isProfileMissing = useCallback(
        (username: string) => missing.has(username),
        [missing],
    );

    const isFollowing = useCallback(
        (username: string) => followingSet.has(username),
        [followingSet],
    );

    const toggleFollow = useCallback(
        async (user: User) => {
            if (!isAuthenticated || !token) {
                throw new Error("请先登录后再关注");
            }

            const username = user.username;
            const following = !followingSet.has(user.username);
            const delta = following ? 1 : -1;

            setFollowingSet((prev) => {
                const next = new Set(prev);
                if (following) next.add(username);
                else next.delete(username);
                return next;
            });

            try {
                // 投递 Follow / Undo activity 到自己的 outbox
                await api.sendFollowActivity(
                    currentUser.username,
                    user.actorUrl ?? "",
                    following,
                    token,
                );
            } catch (e) {
                // 投递失败：回滚关注状态
                setFollowingSet((prev) => {
                    const next = new Set(prev);
                    if (following) next.delete(username);
                    else next.add(username);
                    return next;
                });
                throw e;
            }

            setUsers((prev) =>
                prev.map((u) =>
                    u.username === username
                        ? { ...u, followers: u.followers + delta }
                        : u,
                ),
            );
            setProfiles((prev) =>
                username in prev
                    ? {
                          ...prev,
                          [username]: {
                              ...prev[username],
                              followers: Math.max(0, prev[username].followers + delta),
                          },
                      }
                    : prev,
            );
            if (username === currentUser.username) return;
            setUsers((prev) =>
                prev.map((u) =>
                    u.username === currentUser.username
                        ? { ...u, following: u.following + delta }
                        : u,
                ),
            );
            setProfiles((prev) => {
                const me = currentUser.username;
                if (!(me in prev)) return prev;
                return {
                    ...prev,
                    [me]: {
                        ...prev[me],
                        following: Math.max(0, prev[me].following + delta),
                    },
                };
            });
        },
        [followingSet, currentUser.username, isAuthenticated, token],
    );

    const updateProfile = useCallback(
        async (patch: ProfilePatch) => {
            await api.updateProfile(currentUser.username, patch, token);
            setProfiles((prev) => {
                const base =
                    prev[currentUser.username] ?? toFallbackUser(currentUser.username);
                return { ...prev, [currentUser.username]: { ...base, ...patch } };
            });
            setUsers((prev) =>
                prev.map((u) =>
                    u.username === currentUser.username ? { ...u, ...patch } : u,
                ),
            );
        },
        [currentUser.username, token],
    );

    const incrementPostsCount = useCallback((username: string, delta: number) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.username === username ? { ...u, postsCount: u.postsCount + delta } : u,
            ),
        );
        setProfiles((prev) =>
            username in prev
                ? {
                      ...prev,
                      [username]: {
                          ...prev[username],
                          postsCount: Math.max(0, prev[username].postsCount + delta),
                      },
                  }
                : prev,
        );
    }, []);

    const value = useMemo<UserStoreValue>(
        () => ({
            users,
            currentUser,
            getUser,
            isProfileMissing,
            loadProfile,
            isFollowing,
            toggleFollow,
            updateProfile,
            incrementPostsCount,
        }),
        [
            users,
            currentUser,
            getUser,
            isProfileMissing,
            loadProfile,
            isFollowing,
            toggleFollow,
            updateProfile,
            incrementPostsCount,
        ],
    );

    return <UserStoreContext.Provider value={value}>{children}</UserStoreContext.Provider>;
}

export function useUserStore() {
    const ctx = useContext(UserStoreContext);
    if (!ctx) throw new Error("useUserStore must be used within UserStoreProvider");
    return ctx;
}
