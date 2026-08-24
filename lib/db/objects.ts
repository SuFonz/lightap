import { env } from "cloudflare:workers"
import { ObjectRow } from "@/lib/types/db"

export async function getNotesByPreferredUsername(
    preferredUsername: string,
    limit: number | null = null,
    offset: number | null = null,
): Promise<ObjectRow[]> {
    let sql = `
        SELECT o.*
        FROM objects o
        INNER JOIN users u ON u.id = o.actor_id
        WHERE u.preferred_username = ?
          AND o.type = 'Note'
        ORDER BY o.created_at DESC
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

    const rows = await env.DB
        .prepare(sql)
        .bind(...params)
        .all<ObjectRow>();

    return rows.results;
}

export async function getReceivedNotes(
    limit: number | null = null,
    offset: number | null = null,
): Promise<ObjectRow[]> {
    let sql = `
        SELECT o.*
        FROM objects o
        WHERE o.type = 'Note'
          AND o.author_id NOT IN (SELECT CAST(id AS TEXT) FROM users)
        ORDER BY o.created_at DESC
    `;

    const params: (string | number)[] = [];

    if (limit !== null) {
        sql += ` LIMIT ?`;
        params.push(limit);

        if (offset !== null) {
            sql += ` OFFSET ?`;
            params.push(offset);
        }
    }

    const rows = await env.DB
        .prepare(sql)
        .bind(...params)
        .all<ObjectRow>();

    return rows.results;
}

export async function insertObject(
    name: string,
    type: string,
    authorId: string,
    content: string,
): Promise<number> {
    const res = await env.DB
        .prepare(
            `INSERT INTO objects (name, type, author_id, content, created_at)
             VALUES (?, ?, ?, ?, ?)`
        )
        .bind(name, type, authorId, content, Date.now())
        .run();

    return res.meta.last_row_id;
}
