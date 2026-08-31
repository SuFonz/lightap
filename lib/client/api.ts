import {
    seedNotifications,
    seedPosts,
    seedTrends,
    seedUsers,
} from "./mock-data";
import type { AppNotification, Post, TrendingTag, User } from "./types";

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function fetchFeed(): Promise<Post[]> {
    await delay();
    return clone(seedPosts);
}

export async function fetchUsers(): Promise<User[]> {
    await delay();
    return clone(seedUsers);
}

export async function fetchUser(username: string): Promise<User | null> {
    await delay(250);
    return clone(seedUsers.find((u) => u.username === username) ?? null);
}

export async function fetchUserPosts(username: string): Promise<Post[]> {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}/posts`);
    if (res.status === 404) {
        // 站内演示用户（无真实账号）：回退到本地种子数据
        await delay(250);
        return clone(seedPosts.filter((p) => p.authorUsername === username));
    }
    if (!res.ok) throw new Error("获取帖子失败");
    const data = (await res.json()) as { posts: Post[] };
    return data.posts;
}

export interface ApiUserProfile {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    followers: number;
    followingCount: number;
    postsCount: number;
    createdAt: string;
}

export async function fetchUserProfile(
    username: string,
): Promise<ApiUserProfile | null> {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("获取资料失败");
    return (await res.json()) as ApiUserProfile;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
    await delay();
    return clone(seedNotifications);
}

export async function fetchTrends(): Promise<TrendingTag[]> {
    await delay(200);
    return clone(seedTrends);
}

export async function createPost(
    username: string,
    content: string,
): Promise<Post> {
    await delay();
    return {
        id: `p-${Date.now()}`,
        authorUsername: username,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        boosts: 0,
        boostedByMe: false,
        replies: [],
    };
}

export async function createReply(
    _postId: string,
    username: string,
    content: string,
): Promise<Post> {
    await delay();
    return {
        id: `r-${Date.now()}`,
        authorUsername: username,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        boosts: 0,
        boostedByMe: false,
        replies: [],
    };
}

export async function toggleLike(_postId: string, liked: boolean) {
    await delay(180);
    return liked;
}

export async function toggleBoost(_postId: string, boosted: boolean) {
    await delay(180);
    return boosted;
}

export async function setFollow(username: string, following: boolean) {
    await delay(280);
    return { username, following };
}

export interface ProfilePatch {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
}

export async function updateProfile(
    username: string,
    patch: ProfilePatch,
    token: string | null,
): Promise<void> {
    if (!token) {
        // 未登录（演示模式）：仅本地生效
        await delay(400);
        return;
    }

    const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
    });

    if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
        throw new Error(data?.error ?? "保存失败，请稍后重试");
    }
}
