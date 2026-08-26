import {
    CURRENT_USERNAME,
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
    await delay(250);
    return clone(seedPosts.filter((p) => p.authorUsername === username));
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
    _username: string,
    content: string,
): Promise<Post> {
    await delay();
    return {
        id: `p-${Date.now()}`,
        authorUsername: CURRENT_USERNAME,
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
    content: string,
): Promise<Post> {
    await delay();
    return {
        id: `r-${Date.now()}`,
        authorUsername: CURRENT_USERNAME,
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

export async function updateProfile(patch: ProfilePatch) {
    await delay(400);
    return clone(patch);
}
