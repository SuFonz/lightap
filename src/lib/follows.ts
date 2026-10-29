import { follows, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { and, desc, eq, lt } from "drizzle-orm";

const MAX_LIMIT = 50;

/** 关注 / 粉丝列表项：只暴露展示需要的字段，不返回私钥等敏感列 */
export interface FollowUserItem {
    username: string;
    displayName: string;
    avatarUrl: string;
    /** 所在实例域名 */
    domain: string;
    bio: string;
    actorUrl: string;
    /** 分页游标（follows.id），前端拿最后一项的值作为下一页的 maxId */
    cursorId: number;
}

export interface FollowListResult {
    items: FollowUserItem[];
    /** 是否还有下一页 */
    hasMore: boolean;
}

/**
 * 关注 / 粉丝列表的共用实现。
 *
 * 两者结构完全对称，只是方向相反：
 * - following：`follows.follower = 目标用户` → 取 `following` 那列对应的人
 * - followers：`follows.following = 目标用户` → 取 `follower` 那列对应的人
 *
 * 分页用 `follows.id` 作游标（不是 users.id）：
 * 列表按「关注关系建立时间」倒序，游标必须与排序键同源，
 * 否则翻页会漏人 / 重复（与 feed 用 notes.id 的道理相同）。
 */
export async function listFollows(options: {
    username: string;
    domain: string;
    direction: "following" | "followers";
    limit?: number;
    maxId?: number;
}): Promise<FollowListResult | null> {
    const { username, domain, direction, limit: rawLimit, maxId } = options;
    const limit = Math.min(rawLimit || MAX_LIMIT, MAX_LIMIT);

    const db = getDBClient();
    const target = (await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.domain, domain),
        ),
    ))[0];
    // null 表示用户不存在，由调用方决定返回 404
    if (!target) return null;

    // 方向决定：过滤哪一列、连到哪一列
    const filterColumn = direction === "following" ? follows.follower : follows.following;
    const joinColumn = direction === "following" ? follows.following : follows.follower;

    const rows = await db.select({
        cursorId: follows.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        domain: users.domain,
        summary: users.summary,
        actorUrl: users.actorUrl,
    })
        .from(follows)
        .innerJoin(users, eq(users.actorUrl, joinColumn))
        .where(and(
            eq(filterColumn, target.actorUrl),
            maxId ? lt(follows.id, maxId) : undefined,
        ))
        .orderBy(desc(follows.id))
        .limit(limit);

    const items: FollowUserItem[] = rows.map(row => ({
        username: row.username,
        displayName: row.displayName ?? row.username,
        avatarUrl: row.avatarUrl ?? "",
        domain: row.domain,
        bio: row.summary ?? "",
        actorUrl: row.actorUrl,
        cursorId: row.cursorId,
    }));

    return {
        items,
        hasMore: items.length === limit,
    };
}
