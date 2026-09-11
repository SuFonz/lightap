import { env } from "cloudflare:workers";
import { FeedNoteRow } from "@/lib/types/db";

/**
 * 关注线写入（fan-out on write）：
 * 给 actorUrls 里所有本站用户各插一行，INSERT OR IGNORE 天然去重幂等
 */
export async function addToTimeline(
    objectId: number,
    createdAt: number,
    actorUrls: string[],
): Promise<void> {
    if (actorUrls.length === 0) return;

    await env.DB
        .prepare(
            `
            INSERT OR IGNORE INTO timeline (user_id, object_id, created_at)
            SELECT u.id, ?, ?
            FROM users u
            WHERE u.actor_url IN (SELECT value FROM json_each(?))
            `
        )
        .bind(objectId, createdAt, JSON.stringify(actorUrls))
        .run();
}

/**
 * 关注线读取：某个用户的 timeline
 */
export async function getTimelineForUser(
    userId: number,
    limit: number = 50,
    offset: number = 0,
): Promise<FeedNoteRow[]> {
    const rows = await env.DB
        .prepare(
            `
            SELECT o.*, u.preferred_username AS author_username
            FROM timeline t
            INNER JOIN objects o ON o.id = t.object_id
            INNER JOIN users u ON u.actor_url = o.actor
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC, t.object_id DESC
            LIMIT ? OFFSET ?
            `
        )
        .bind(userId, limit, offset)
        .all();

    return rows.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number),
    })) as FeedNoteRow[];
}

/**
 * 删除帖子时同步清理时间线
 */
export async function removeFromTimeline(objectId: number): Promise<void> {
    await env.DB
        .prepare(
            `
            DELETE FROM timeline
            WHERE object_id = ?
            `
        )
        .bind(objectId)
        .run();
}
