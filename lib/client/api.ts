import { buildCreateNote, buildFollow, buildUnfollow } from "@/lib/activitypub/tools";
import { AuthToken, Post, ProfilePatch, SearchResult, User, UserProfile } from "@/lib/types/http";

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchUserPosts(username: string): Promise<Post[]> {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}/posts`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error("获取帖子失败");
    const data = (await res.json()) as { posts: Post[] };
    return data.posts;
}

export type FeedType = "public" | "following";

/**
 * 时间线：public 无需登录；following 需要 token
 */
export async function fetchFeed(
    type: FeedType,
    token?: string | null,
    limit: number = 50,
    offset: number = 0,
): Promise<Post[]> {
    const params = new URLSearchParams({
        type,
        limit: String(limit),
        offset: String(offset),
    });

    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`/api/v1/feed?${params.toString()}`, { headers });
    if (!res.ok) return [];

    const data = (await res.json()) as { posts: Post[] };
    return data.posts;
}

async function requestAuth(
    path: string,
    body: { username: string; password: string }
): Promise<AuthToken> {
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as
        | (AuthToken & { error?: string })
        | null;

    if (!res.ok || !data?.token) {
        throw new Error(data?.error ?? "请求失败，请稍后重试");
    }

    return { username: data.username, token: data.token };
}

/**
 * 登录
 */
export function login(username: string, password: string): Promise<AuthToken> {
    return requestAuth("/api/v1/auth/login", {
        username: username.trim(),
        password,
    });
}

/**
 * 注册
 */
export function register(username: string, password: string): Promise<AuthToken> {
    return requestAuth("/api/v1/auth/register", {
        username: username.trim(),
        password,
    });
}

/**
 * 用 token 换取当前用户名，token 无效时返回 null
 */
export async function me(token: string): Promise<string | null> {
    const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as {
        username?: string;
    } | null;

    return data?.username ?? null;
}


export async function fetchUserProfile(
    username: string,
): Promise<UserProfile | null> {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(username)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("获取资料失败");
    return (await res.json()) as UserProfile;
}

export async function searchUsers(query: string): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];

    try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return [];
        const data = (await res.json()) as SearchResult;
        return data.users;
    } catch {
        // 网络异常时返回空结果
        return [];
    }
}

/**
 * 关注 / 取消关注：把 Follow（或 Undo{Follow}）activity 投递到自己的 outbox，
 * 由服务器签名转发给对方 inbox
 */
export async function sendFollowActivity(
    me: string,
    targetUrl: string,
    following: boolean,
    token: string,
): Promise<void> {
    const origin = window.location.origin;
    const actor = `${origin}/users/${me}`;

    const activity = following
        ? buildFollow(origin, actor, targetUrl)
        : buildUnfollow(origin, actor, targetUrl);

    const res = await fetch(`/users/${encodeURIComponent(me)}/outbox`, {
        method: "POST",
        headers: {
            "Content-Type": "application/activity+json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activity),
    });

    if (!res.ok) {
        throw new Error("关注操作失败，请稍后重试");
    }
}

/**
 * 发布新帖：把 Create{Note} activity 投递到自己的 outbox，
 * 由服务器落库并转发给关注者
 */
export async function sendCreateNoteActivity(
    me: string,
    content: string,
    token: string,
): Promise<void> {
    const origin = window.location.origin;
    const actor = `${origin}/users/${me}`;

    const activity = buildCreateNote(origin, actor, content);

    const res = await fetch(`/users/${encodeURIComponent(me)}/outbox`, {
        method: "POST",
        headers: {
            "Content-Type": "application/activity+json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activity),
    });

    if (!res.ok) {
        throw new Error("发布失败，请稍后重试");
    }
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
