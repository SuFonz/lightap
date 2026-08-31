"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useAuthStore } from "./auth-store";
import * as api from "@/lib/client/api";
import { CURRENT_USERNAME, seedUsers } from "@/lib/client/mock-data";
import type { User } from "@/lib/client/types";

interface UserStoreValue {
    users: User[];
    currentUser: User;
    getUser: (username: string) => User | undefined;
    isFollowing: (username: string) => boolean;
    toggleFollow: (username: string) => Promise<void>;
    updateProfile: (patch: api.ProfilePatch) => Promise<void>;
    incrementPostsCount: (username: string, delta: number) => void;
}

const UserStoreContext = createContext<UserStoreValue | null>(null);

function toFallbackUser(username: string): User {
    return {
        username,
        displayName: username,
        bio: "",
        instance: "lightap.social",
        followers: 0,
        followingCount: 0,
        postsCount: 0,
        online: true,
    };
}

export function UserStoreProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, username: sessionUsername } = useAuthStore();
    const [users, setUsers] = useState<User[]>(seedUsers);
    const [followingSet, setFollowingSet] = useState<Set<string>>(
        () => new Set(["sakura", "yuki"]),
    );

    const activeUsername =
        isAuthenticated && sessionUsername ? sessionUsername : CURRENT_USERNAME;

    const currentUser = useMemo(
        () => users.find((u) => u.username === activeUsername) ?? toFallbackUser(activeUsername),
        [users, activeUsername],
    );

    const getUser = useCallback(
        (username: string) => users.find((u) => u.username === username),
        [users],
    );

    const isFollowing = useCallback(
        (username: string) => followingSet.has(username),
        [followingSet],
    );

    const toggleFollow = useCallback(
        async (username: string) => {
            const following = !followingSet.has(username);
            setFollowingSet((prev) => {
                const next = new Set(prev);
                if (following) next.add(username);
                else next.delete(username);
                return next;
            });
            await api.setFollow(username, following);
            setUsers((prev) =>
                prev.map((u) =>
                    u.username === username
                        ? { ...u, followers: u.followers + (following ? 1 : -1) }
                        : u,
                ),
            );
            if (username === currentUser.username) return;
            setUsers((prev) =>
                prev.map((u) =>
                    u.username === currentUser.username
                        ? { ...u, followingCount: u.followingCount + (following ? 1 : -1) }
                        : u,
                ),
            );
        },
        [followingSet, currentUser.username],
    );

    const updateProfile = useCallback(
        async (patch: api.ProfilePatch) => {
            await api.updateProfile(patch);
            setUsers((prev) =>
                prev.map((u) => (u.username === currentUser.username ? { ...u, ...patch } : u)),
            );
        },
        [currentUser.username],
    );

    const incrementPostsCount = useCallback((username: string, delta: number) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.username === username ? { ...u, postsCount: u.postsCount + delta } : u,
            ),
        );
    }, []);

    const value = useMemo<UserStoreValue>(
        () => ({
            users,
            currentUser,
            getUser,
            isFollowing,
            toggleFollow,
            updateProfile,
            incrementPostsCount,
        }),
        [users, currentUser, getUser, isFollowing, toggleFollow, updateProfile, incrementPostsCount],
    );

    return <UserStoreContext.Provider value={value}>{children}</UserStoreContext.Provider>;
}

export function useUserStore() {
    const ctx = useContext(UserStoreContext);
    if (!ctx) throw new Error("useUserStore must be used within UserStoreProvider");
    return ctx;
}
