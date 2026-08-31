import { seedUsers } from "./mock-data";
import type { User } from "./types";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 搜索用户 —— 后端占位实现。
 *
 * TODO: 后端接口就绪后请替换为真实请求，例如：
 *   const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`);
 *   if (!res.ok) throw new Error("搜索失败");
 *   return (await res.json()) as User[];
 */
export async function searchUsers(query: string): Promise<User[]> {
    await delay();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return seedUsers.filter(
        (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            u.bio.toLowerCase().includes(q),
    );
}
