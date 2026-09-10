import { env } from "cloudflare:workers"
import { UserRow, UserSearchRow } from "@/lib/types/db"

export async function getUserByPreferredUsername(
    preferredUsername: string
): Promise<UserRow | null> {
    const row = await env.DB
        .prepare(
            `
            SELECT *
            FROM users
            WHERE preferred_username = ?
            LIMIT 1
            `
        )
        .bind(preferredUsername)
        .first();

    if (!row) {
        return null;
    }

    return {
        ...row,
        created_at: new Date(row.created_at as number),
        updated_at: new Date(row.updated_at as number),
    } as UserRow;
}

export async function getUserByActorUrl(actorUrl: string): Promise<UserRow | null> {
    const row = await env.DB
        .prepare(
            `
            SELECT *
            FROM users
            WHERE actor_url = ?
            LIMIT 1
            `
        )
        .bind(actorUrl)
        .first();

    if (!row) {
        return null;
    }

    return {
        ...row,
        created_at: new Date(row.created_at as number),
        updated_at: new Date(row.updated_at as number),
    } as UserRow;
}

export async function searchUsersWithCounts(
    query: string,
    limit: number = 20
): Promise<UserSearchRow[]> {
    const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
    const like = `%${escaped}%`;

    const rows = await env.DB
        .prepare(
            `
            SELECT u.*,
                (SELECT COUNT(*) FROM follows f WHERE f.following = u.actor_url) AS followers_count,
                (SELECT COUNT(*) FROM follows f WHERE f.follower = u.actor_url) AS following_count,
                (SELECT COUNT(*) FROM objects o WHERE o.actor = u.actor_url AND o.type = 'Note') AS posts_count
            FROM users u
            WHERE u.preferred_username LIKE ? ESCAPE '\\'
               OR u.name LIKE ? ESCAPE '\\'
               OR u.summary LIKE ? ESCAPE '\\'
            ORDER BY (u.preferred_username = ?) DESC, u.created_at DESC
            LIMIT ?
            `
        )
        .bind(like, like, like, query, limit)
        .all<UserSearchRow>();

    return rows.results;
}

export async function upsertRemoteUser(params: {
    actorUrl: string;
    username: string;
    displayName: string;
    summary: string | null;
    iconUrl: string | null;
    publicKeyPem: string;
}): Promise<void> {
    const now = Date.now();
    const existing = await getUserByPreferredUsername(params.username);

    if (existing && existing.actor_url === params.actorUrl) {
        await env.DB
            .prepare(
                `
                UPDATE users
                SET name = ?, summary = ?, icon_url = ?, public_key_pem = ?, updated_at = ?
                WHERE actor_url = ?
                `
            )
            .bind(
                params.displayName,
                params.summary,
                params.iconUrl,
                params.publicKeyPem,
                now,
                params.actorUrl
            )
            .run();
        return;
    }

    if (existing) {
        // 同名柄已被本站用户占用，不落库，仅返回搜索结果
        return;
    }

    await env.DB
        .prepare(
            `
            INSERT INTO users (
                actor_url,
                name,
                preferred_username,
                summary,
                icon_url,
                public_key_pem,
                private_key_pem,
                password_hash,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
            `
        )
        .bind(
            params.actorUrl,
            params.displayName,
            params.username,
            params.summary,
            params.iconUrl,
            params.publicKeyPem,
            now,
            now
        )
        .run();
}

export async function updateUserProfile(
    preferredUsername: string,
    patch: {
        name?: string;
        summary?: string;
        icon_url?: string;
    }
): Promise<void> {
    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (patch.name !== undefined) {
        sets.push("name = ?");
        params.push(patch.name);
    }
    if (patch.summary !== undefined) {
        sets.push("summary = ?");
        params.push(patch.summary);
    }
    if (patch.icon_url !== undefined) {
        sets.push("icon_url = ?");
        params.push(patch.icon_url);
    }

    sets.push("updated_at = ?");
    params.push(Date.now(), preferredUsername);

    await env.DB
        .prepare(
            `
            UPDATE users
            SET ${sets.join(", ")}
            WHERE preferred_username = ?
            `
        )
        .bind(...params)
        .run();
}

export async function createUser(params: {
    origin: string;
    username: string;
    passwordHash: string;
    publicKeyPem: string;
    privateKeyPem: string;
    /** 显示昵称，默认与用户名相同 */
    name?: string;
    summary?: string | null;
}): Promise<void> {
    const now = Date.now();

    await env.DB
        .prepare(
            `
            INSERT INTO users (
                actor_url,
                name,
                preferred_username,
                summary,
                icon_url,
                public_key_pem,
                private_key_pem,
                password_hash,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            `${params.origin}/users/${params.username}`,
            params.name ?? params.username,
            params.username,
            params.summary ?? null,
            params.publicKeyPem,
            params.privateKeyPem,
            params.passwordHash,
            now,
            now
        )
        .run();
}
