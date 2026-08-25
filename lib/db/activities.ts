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
    id: string,
    type: APActivityType,
    actorId: string,
    objectId: string,
    to: string[] | null,
    cc: string[] | null,
): Promise<string> {
    await env.DB
        .prepare(
            `
            INSERT INTO activities
            (
                id,
                type,
                actor_id,
                object_id,
                to_json,
                cc_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `
        )
        .bind(
            id,
            type,
            actorId,
            objectId,
            to ? JSON.stringify(to) : null,
            cc ? JSON.stringify(cc) : null,
            Date.now()
        )
        .run();

    return id;
}
