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
        INNER JOIN users u ON u.actor_url = o.actor
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
        .all();

    return rows.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number),
    })) as ObjectRow[];
}

export async function getReceivedNotesOf(
    preferredUsername: string,
    limit: number | null = null,
    offset: number | null = null
): Promise<ObjectRow[]> {

    let sql = `
        SELECT o.*
        FROM activities a
        INNER JOIN objects o
            ON o.id = a.object
        INNER JOIN users u
            ON u.preferred_username = ?
        WHERE o.type = 'Note'
          AND (
              EXISTS (
                  SELECT 1
                  FROM json_each(a.to_json)
                  WHERE json_each.value = u.actor_url
              )
              OR
              EXISTS (
                  SELECT 1
                  FROM json_each(a.cc_json)
                  WHERE json_each.value = u.actor_url
              )
          )
        ORDER BY o.created_at DESC
    `;

    const params: (string | number)[] = [
        preferredUsername
    ];

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
        .all();

    return rows.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number)
    })) as ObjectRow[];
}

export async function countNotesByPreferredUsername(
    preferredUsername: string
): Promise<number> {
    const row = await env.DB
        .prepare(
            `
            SELECT COUNT(*) AS total
            FROM objects o
            INNER JOIN users u ON u.actor_url = o.actor
            WHERE u.preferred_username = ?
              AND o.type = 'Note'
            `
        )
        .bind(preferredUsername)
        .first<{ total: number }>();

    return row?.total ?? 0;
}

export async function insertNote(
    url: string,
    actorUrl: string,
    name: string | null,
    content: string,
): Promise<number> {
    const result = await env.DB
        .prepare(
            `
            INSERT INTO objects
            (
                url,
                name,
                type,
                actor,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            url,
            name,
            "Note",
            actorUrl,
            content,
            Date.now()
        )
        .run();

    return result.meta.last_row_id;
}
