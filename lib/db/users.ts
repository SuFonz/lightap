import { env } from "cloudflare:workers"
import { UserRow } from "@/lib/types/db"
import { User } from "@/lib/types/model"

export async function getUserByUsername(
    username: string
): Promise<User | null> {
    const row = await env.DB
        .prepare(
            `
            SELECT *
            FROM users
            WHERE username = ?
            LIMIT 1
            `
        )
        .bind(username)
        .first<UserRow>();

    if (!row) {
        return null;
    }

    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        summary: row.summary ?? undefined,
        iconUrl: row.icon_url ?? undefined,
        privateKeyPem: row.private_key_pem ?? undefined,
        publicKeyPem: row.public_key_pem,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}