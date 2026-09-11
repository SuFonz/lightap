import { env } from "cloudflare:workers"
import { AP_CONTEXT_PUBLIC } from "@/lib/types/activitypub"
import { FeedNoteRow, ObjectRow } from "@/lib/types/db"

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
    to: string[] | null = null,
    cc: string[] | null = null
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
                to_json,
                cc_json,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            url,
            name,
            "Note",
            actorUrl,
            to ? JSON.stringify(to) : null,
            cc ? JSON.stringify(cc) : null,
            content,
            Date.now()
        )
        .run();

    return result.meta.last_row_id;
}

/**
 * 接收远程投递时，按 url 取 Note，不存在才插入。
 * 接收本地投递时，本地用户之间互相投递时同一个 note url 会重复到达，避免 UNIQUE 冲突。
 */
export async function getOrCreateNote(
    url: string,
    actorUrl: string,
    name: string | null,
    content: string,
    to: string[] | null = null,
    cc: string[] | null = null
): Promise<number> {
    const existing = await env.DB
        .prepare(
            `
            SELECT id
            FROM objects
            WHERE url = ?
            LIMIT 1
            `
        )
        .bind(url)
        .first<{ id: number }>();

    if (existing) {
        return existing.id;
    }

    return insertNote(url, actorUrl, name, content, to, cc);
}

/**
 * 公共时间线：Create 活动投递到 #Public 的 Note，按发布时间倒序
 */
export async function getPublicFeed(
    limit: number = 50,
    offset: number = 0,
): Promise<FeedNoteRow[]> {
    const rows = await env.DB
        .prepare(
            `
            SELECT o.*, u.preferred_username AS author_username
            FROM objects o
            INNER JOIN users u ON u.actor_url = o.actor
            WHERE o.type = 'Note'
              AND EXISTS (
                  SELECT 1
                  FROM activities a
                  WHERE a.object = o.id
                    AND a.type = 'Create'
                    AND (
                        EXISTS (SELECT 1 FROM json_each(a.to_json) WHERE json_each.value = ?)
                        OR EXISTS (SELECT 1 FROM json_each(a.cc_json) WHERE json_each.value = ?)
                    )
              )
            ORDER BY o.created_at DESC, o.id DESC
            LIMIT ? OFFSET ?
            `
        )
        .bind(AP_CONTEXT_PUBLIC, AP_CONTEXT_PUBLIC, limit, offset)
        .all();

    return rows.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number),
    })) as FeedNoteRow[];
}
