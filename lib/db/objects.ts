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

export async function insertNote(actorId: string, name: string, content: string) {
    const res = await env.DB
        .prepare(
            `INSERT INTO objects VALUES(name, type, actor_id, content, created_at)
             VALUES (?, ?, ?, ?, ?)`
        )
        .bind(name, "Note", actorId, content, Date.now())
        .run();
    
    return res.meta.last_row_id;
}
