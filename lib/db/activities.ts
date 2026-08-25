import { env } from "cloudflare:workers";
import { ActivityRow } from "@/lib/types/db";
import { APActivityType } from "../types/activitypub";

export async function getActivitiesByPreferredUsername(
    preferredUsername: string,
    limit: number | null = null,
): Promise<ActivityRow[] | null> {
    let sql = `
        SELECT a.*
        FROM activity a
        INNER JOIN users u ON u.id = a.actor_id
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
        .all<ActivityRow>();

    return rows.results;
}

export async function insertActivity(
    type: APActivityType,
    actorId: string,
    objectId: number,
): Promise<number> {
    const res = await env.DB
        .prepare(
            `INSERT INTO activities (type, actor_id, object_id, created_at)
             VALUES (?, ?, ?, ?)`
        )
        .bind(type, actorId, objectId, Date.now())
        .run();

    return res.meta.last_row_id;
}
