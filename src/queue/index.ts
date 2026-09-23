import { env } from "cloudflare:workers";
import { delivery } from "@/src/activitypub/network";
import { getDBClient } from "../db";
import { activities, notes, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildActivityWithUri, buildNoteWithUri, convertActorUrlToMainKey } from "../activitypub/tools";
import { APObject } from "../activitypub/ap";

export interface QueueData {
    targetActor: string,
    activityId: number,
}

export async function produce(data: QueueData) {
    await env.AP_QUEUE.send(data);
}

export async function consume(data: QueueData) {
    console.log(data);

    // 查询 Activity
    const db = getDBClient();
    const dbAct = (await db.select().from(activities).where(eq(activities.id, data.activityId)))[0];
    if (!dbAct) {
        return;
    }

    // 取发起者私钥（Activity 的 actor 就是本地用户）
    const user = (await db.select().from(users).where(eq(users.actorUrl, dbAct.actor)))[0];
    if (!user) {
        return;
    }

    // 根据 Object 类型构建不同的 Object：
    // Note 是内嵌对象，从 notes 表取出后构建；其它类型（Follow / Accept / Undo ...）的 object 只是一个链接
    let object: APObject | string = dbAct.objectUri ?? "";
    if (dbAct.objectId && dbAct.objectType) {
        switch (dbAct.objectType) {
            case "Note": {
                const dbNote = (await db.select().from(notes).where(eq(notes.id, dbAct.objectId)))[0];
                if (dbNote) {
                    object = buildNoteWithUri({
                        uri: dbNote.uri,
                        content: dbNote.content,
                        inReplyTo: dbNote.inReplyTo ?? undefined,
                        cc: [`${user.actorUrl}/followers`],
                    });
                }
                break;
            }

            case "Follow": {
                // Follow 的 object 是目标 Actor 的链接，直接用 objectUri
                break;
            }

            default: {
                break;
            }
        }
    }

    // 用 Activity 包裹 Object
    const activity = buildActivityWithUri({
        uri: dbAct.uri,
        type: dbAct.type,
        actor: dbAct.actor,
        object,
        cc: [`${user.actorUrl}/followers`],
    });

    console.log(activity);

    // 递送
    await delivery(data.targetActor, activity, user.privateKey, convertActorUrlToMainKey(user.actorUrl));
}
