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

export async function createUser(params: {
    origin: string;
    username: string;
    passwordHash: string;
    publicKeyPem: string;
    privateKeyPem: string;
}): Promise<void> {
    const now = Date.now();

    await env.DB
        .prepare(
            `
            INSERT INTO users (
                id,
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
            VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            `${params.origin}/users/${params.username}`,
            params.username,
            params.username,
            params.publicKeyPem,
            params.privateKeyPem,
            params.passwordHash,
            now,
            now
        )
        .run();
}
