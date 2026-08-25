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
        .first<UserRow>();

    if (!row) {
        return null;
    }

    return row;
}
