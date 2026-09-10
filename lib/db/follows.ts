import { env } from "cloudflare:workers"
import { FollowRow } from "@/lib/types/db"

export async function getFollowersOf(
    preferredUsername: string,
    limit: number | null = null,
    offset: number | null = null,
): Promise<FollowRow[] | null> {
    let sql = `
        SELECT f.*
        FROM follows f
        INNER JOIN users u ON u.actor_url = f.following
        WHERE u.preferred_username = ?
        ORDER BY f.created_at DESC
    `;

    const params: (string | number)[] = [preferredUsername];

    if (limit !== null) {
        sql += ` LIMIT ?`;
        params.push(limit);

        if (offset !== null) {
            sql += ` OFFSET ?`;
            params.push(offset);
        }
    }

    const result = await env.DB
        .prepare(sql)
        .bind(...params)
        .all();

    return result.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number),
    })) as FollowRow[];
}

export async function getFollowingOf(
    preferredUsername: string,
    limit: number | null = null,
    offset: number | null = null,
): Promise<FollowRow[] | null> {
    let sql = `
        SELECT f.*
        FROM follows f
        INNER JOIN users u ON u.actor_url = f.follower
        WHERE u.preferred_username = ?
        ORDER BY f.created_at DESC
    `;

    const params: (string | number)[] = [preferredUsername];

    if (limit !== null) {
        sql += ` LIMIT ?`;
        params.push(limit);

        if (offset !== null) {
            sql += ` OFFSET ?`;
            params.push(offset);
        }
    }

    const result = await env.DB
        .prepare(sql)
        .bind(...params)
        .all<FollowRow>();

    return result.results;
}

export async function countFollowersOf(
    preferredUsername: string
): Promise<number> {
    const row = await env.DB
        .prepare(
            `
            SELECT COUNT(*) AS total
            FROM follows f
            INNER JOIN users u ON u.actor_url = f.following
            WHERE u.preferred_username = ?
            `
        )
        .bind(preferredUsername)
        .first<{ total: number }>();

    return row?.total ?? 0;
}

export async function countFollowingOf(
    preferredUsername: string
): Promise<number> {
    const row = await env.DB
        .prepare(
            `
            SELECT COUNT(*) AS total
            FROM follows f
            INNER JOIN users u ON u.actor_url = f.follower
            WHERE u.preferred_username = ?
            `
        )
        .bind(preferredUsername)
        .first<{ total: number }>();

    return row?.total ?? 0;
}

export async function deleteFollow(
    follower: string,
    following: string
): Promise<void> {
    await env.DB
        .prepare(
            `
            DELETE FROM follows
            WHERE follower = ?
              AND following = ?
            `
        )
        .bind(follower, following)
        .run();
}

export async function insertFollow(
    follower: string,
    following: string,
): Promise<void> {
    await env.DB
        .prepare(
            `
            INSERT INTO follows
            (
                follower,
                following,
                created_at
            )
            VALUES (?, ?, ?)
            ON CONFLICT(follower, following) DO NOTHING
            `
        )
        .bind(
            follower,
            following,
            Date.now()
        )
        .run();
}
