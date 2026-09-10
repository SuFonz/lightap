import { env } from "cloudflare:workers";
import { ActivityRow } from "@/lib/types/db";
import { APActivityType } from "../types/activitypub";

export async function getActivitiesByPreferredUsername(
    preferredUsername: string,
    limit: number | null = null,
): Promise<ActivityRow[] | null> {
    let sql = `
        SELECT a.*
        FROM activities a
        INNER JOIN users u ON u.actor_url = a.actor
        WHERE u.preferred_username = ?
        ORDER BY a.created_at DESC
    `;

    const params: (string | number)[] = [preferredUsername];
    
    if (limit !== null) {
        sql += ` LIMIT ?`;
        params.push(limit);
    }

    const rows = await env.DB
        .prepare(sql)
        .bind(...params)
        .all();

    return rows.results.map((row) => ({
        ...row,
        created_at: new Date(row.created_at as number),
    })) as ActivityRow[];
}

export async function insertActivity(
    type: APActivityType,
    actorUrl: string,
    objectId: number,
    to: string[] | null,
    cc: string[] | null,
): Promise<number> {
    const result = await env.DB
        .prepare(
            `
            INSERT INTO activities
            (
                type,
                actor,
                object,
                to_json,
                cc_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            type,
            actorUrl,
            objectId,
            to ? JSON.stringify(to) : null,
            cc ? JSON.stringify(cc) : null,
            Date.now()
        )
        .run();

    return result.meta.last_row_id;
}
