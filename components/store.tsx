"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as api from "@/lib/api";
import { CURRENT_USERNAME, seedNotifications, seedPosts, seedTrends, seedUsers } from "@/lib/mock-data";
import type { AppNotification, Post, TrendingTag, User } from "@/lib/types";

interface StoreValue {
    currentUser: User;
    users: User[];
    posts: Post[];
    trends: TrendingTag[];
    notifications: AppNotification[];
    unreadCount: number;
    isFollowing: (username: string) => boolean;
    toggleFollow: (username: string) => Promise<void>;
    getUser: (username: string) => User | undefined;
    getPost: (postId: string) => Post | undefined;
    getPostPath: (postId: string) => Post[] | null;
    addPost: (content: string) => Promise<void>;
    addReply: (postId: string, content: string) => Promise<void>;
    toggleLike: (postId: string) => Promise<void>;
    toggleBoost: (postId: string) => Promise<void>;
    updateProfile: (patch: api.ProfilePatch) => Promise<void>;
    markAllNotificationsRead: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function updateTree(list: Post[], id: string, fn: (p: Post) => Post): Post[] {
    return list.map((p) => {
        if (p.id === id) return fn(p);
        if (p.replies.length > 0) return { ...p, replies: updateTree(p.replies, id, fn) };
        return p;
    });
}

function findRecursive(list: Post[], id: string): Post | undefined {
    for (const p of list) {
        if (p.id === id) return p;
        const nested = findRecursive(p.replies, id);
        if (nested) return nested;
    }
    return undefined;
}

function findPath(list: Post[], id: string): Post[] | null {
    for (const p of list) {
        if (p.id === id) return [p];
        const child = findPath(p.replies, id);
        if (child) return [p, ...child];
    }
    return null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
    const [users, setUsers] = useState<User[]>(seedUsers);
    const [posts, setPosts] = useState<Post[]>(seedPosts);
    const [notifications, setNotifications] = useState<AppNotification[]>(
        seedNotifications,
    );
    const trends = seedTrends;

    const currentUser = useMemo(
        () => users.find((u) => u.username === CURRENT_USERNAME)!,
        [users],
    );

    const [followingSet, setFollowingSet] = useState<Set<string>>(
        () => new Set(["sakura", "yuki"]),
    );

    const getUser = useCallback(
        (username: string) => users.find((u) => u.username === username),
        [users],
    );

    const getPost = useCallback(
        (postId: string) => findRecursive(posts, postId),
        [posts],
    );

    const getPostPath = useCallback(
        (postId: string) => findPath(posts, postId),
        [posts],
    );

    const isFollowing = useCallback(
        (username: string) => followingSet.has(username),
        [followingSet],
    );

    const toggleFollow = useCallback(async (username: string) => {
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
        if (username === CURRENT_USERNAME) return;
        setUsers((prev) =>
            prev.map((u) =>
                u.username === CURRENT_USERNAME
                    ? { ...u, followingCount: u.followingCount + (following ? 1 : -1) }
                    : u,
            ),
        );
    }, [followingSet]);
    const addPost = useCallback(async (content: string) => {
        const post = await api.createPost(CURRENT_USERNAME, content);
        setPosts((prev) => [post, ...prev]);
        setUsers((prev) =>
            prev.map((u) =>
                u.username === CURRENT_USERNAME
                    ? { ...u, postsCount: u.postsCount + 1 }
                    : u,
            ),
        );
    }, []);

    const addReply = useCallback(async (postId: string, content: string) => {
        const reply = await api.createReply(postId, content);
        setPosts((prev) =>
            updateTree(prev, postId, (p) => ({ ...p, replies: [...p.replies, reply] })),
        );
    }, []);

    const toggleLike = useCallback(async (postId: string) => {
        setPosts((prev) =>
            updateTree(prev, postId, (p) => {
                if (p.authorUsername === CURRENT_USERNAME) return p;
                const liked = !p.likedByMe;
                void api.toggleLike(postId, liked);
                return { ...p, likedByMe: liked, likes: p.likes + (liked ? 1 : -1) };
            }),
        );
    }, []);

    const toggleBoost = useCallback(async (postId: string) => {
        setPosts((prev) =>
            updateTree(prev, postId, (p) => {
                if (p.authorUsername === CURRENT_USERNAME) return p;
                const boosted = !p.boostedByMe;
                void api.toggleBoost(postId, boosted);
                return { ...p, boostedByMe: boosted, boosts: p.boosts + (boosted ? 1 : -1) };
            }),
        );
    }, []);

    const updateProfile = useCallback(async (patch: api.ProfilePatch) => {
        await api.updateProfile(patch);
        setUsers((prev) =>
            prev.map((u) => (u.username === CURRENT_USERNAME ? { ...u, ...patch } : u)),
        );
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const value: StoreValue = {
        currentUser,
        users,
        posts,
        trends,
        notifications,
        unreadCount,
        isFollowing,
        toggleFollow,
        getUser,
        getPost,
        getPostPath,
        addPost,
        addReply,
        toggleLike,
        toggleBoost,
        updateProfile,
        markAllNotificationsRead,
    };

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error("useStore must be used within StoreProvider");
    return ctx;
}
