import { env } from "cloudflare:workers"
import { UserRow } from "@/lib/types/db"

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

export async function getUserById(id: string): Promise<UserRow | null> {
    const row = await env.DB
        .prepare(
            `
            SELECT *
            FROM users
            WHERE id = ?
            LIMIT 1
            `
        )
        .bind(id)
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
