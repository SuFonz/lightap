import { seedUsers } from "./mock-data";
import type { User } from "./types";

const LOCAL_INSTANCE = "lightap.social";

export interface ApiSearchUser {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    /** null 表示本站用户 */
    instance: string | null;
    actorUrl: string | null;
    followers: number;
    following: number;
    postsCount: number;
}

function toUser(dto: ApiSearchUser): User {
    return {
        username: dto.username,
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl ?? undefined,
        instance: dto.instance ?? LOCAL_INSTANCE,
        actorUrl: dto.actorUrl ?? undefined,
        followers: dto.followers,
        following: dto.following,
        postsCount: dto.postsCount,
    };
}

/**
 * 搜索用户。
 *
 * - `@user@domain` / `user@domain`：后端会对该域名做 WebFinger + Actor 解析（联邦搜索），
 *   同时附带本地同名柄匹配
 * - 普通关键词：本站用户名 / 昵称 / 简介模糊匹配
 * - 后端不可用时回退到本地演示数据
 */
export async function searchUsers(query: string): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];

    try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
            const data = (await res.json()) as { users: ApiSearchUser[] };
            return data.users.map(toUser);
        }
    } catch {
        // 网络异常，走演示回退
    }

    const kw = q.replace(/^@+/, "").toLowerCase();
    return seedUsers.filter(
        (u) =>
            u.displayName.toLowerCase().includes(kw) ||
            u.username.toLowerCase().includes(kw) ||
            u.bio.toLowerCase().includes(kw),
    );
}
