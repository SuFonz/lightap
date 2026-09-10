import { SearchUser, User } from "@/lib/types/http";

const LOCAL_INSTANCE = "lightap.social";



function toUser(dto: SearchUser): User {
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
 */
export async function searchUsers(query: string): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];

    try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return [];
        const data = (await res.json()) as { users: SearchUser[] };
        return data.users.map(toUser);
    } catch {
        // 网络异常时返回空结果
        return [];
    }
}
