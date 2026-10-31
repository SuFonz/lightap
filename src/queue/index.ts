import { env } from "cloudflare:workers";
import { delivery } from "@/src/activitypub/network";
import { getDBClient } from "../db";
import { activities, notes, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildActivityWithUri, buildNoteWithUri, buildTombstone, convertActorUrlToMainKey } from "../activitypub/tools";
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
    // Note / Tombstone 是内嵌对象，从 notes 表取出后构建；其它类型（Follow / Accept / Undo ...）的 object 只是一个链接
    let object: APObject | string = dbAct.objectUri ?? "";
    // 只要求 objectType：Delete 活动可能只记录了 objectUri（例如帖子已被手动清掉），
    // 那种情况下仍应构建 Tombstone，不能因为 objectId 为空就整段跳过。
    if (dbAct.objectType) {
        switch (dbAct.objectType) {
            case "Note": {
                // Note 必须靠 objectId 反查内容，没有 id 就保持 objectUri
                if (dbAct.objectId) {
                    const dbNote = (await db.select().from(notes).where(eq(notes.id, dbAct.objectId)))[0];
                    if (dbNote) {
                        object = buildNoteWithUri({
                            uri: dbNote.uri,
                            content: dbNote.content,
                            inReplyTo: dbNote.inReplyTo ?? undefined,
                            cc: [`${user.actorUrl}/followers`],
                        });
                    }
                }
                break;
            }

            case "Tombstone": {
                // Delete 的 object：优先用活动里记录的 objectUri；
                // 没有则用 objectId 反查（软删除时帖子行还在，能查到）。
                const dbNote = dbAct.objectId
                    ? (await db.select().from(notes).where(eq(notes.id, dbAct.objectId)))[0]
                    : undefined;
                const deletedNoteUri = dbAct.objectUri ?? dbNote?.uri;

                if (deletedNoteUri) {
                    object = buildTombstone({
                        id: deletedNoteUri,
                        formerType: "Note",
                        // 软删除时用真实的删除时间；帖子行已不在则退回活动创建时间
                        deleted: dbNote?.deletedAt
                            ? new Date(dbNote.deletedAt * 1000).toISOString()
                            : new Date(dbAct.createdAt * 1000).toISOString(),
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

    // 递送。
    //
    // 关键：失败必须**抛错**，不能静默返回。
    // `delivery()` 失败时只是把失败的 Response 返回回来（不抛异常），
    // 如果这里不检查，consume 会正常结束、外层 ack 掉这条消息，
    // 失败的投递就永远不会重试了。
    const res = await delivery(
        data.targetActor,
        activity,
        user.privateKey,
        convertActorUrlToMainKey(user.actorUrl),
    );

    if (!res.ok) {
        // 带上状态码，方便在日志里定位是哪一类失败（404 对方 Actor 没了 / 401 验签被拒 / 5xx 对方临时故障）
        throw new DeliveryError(
            `投递失败 ${res.status} ${res.statusText} → ${data.targetActor}`,
            res.status,
        );
    }
}

/** 投递失败错误：区分「可重试」与「不该再重试」 */
export class DeliveryError extends Error {
    constructor(
        message: string,
        /** 对方返回的 HTTP 状态码 */
        readonly status: number,
    ) {
        super(message);
        this.name = "DeliveryError";
    }

    /**
     * 这个失败还值得重试吗？
     *
     * - 4xx（除 408 / 429）是**确定性**失败：对方明确拒绝了，重试多少次结果都一样。
     *   典型如 404（对方 Actor / inbox 已不存在）、401（签名被拒）、400（报文不合法）。
     *   继续重试只是浪费配额，还会让对方觉得我们在刷请求。
     * - 5xx、408（超时）、429（限流）是**临时性**故障，值得重试。
     * - 其它（网络错误没有状态码，用 0 表示）也按临时故障处理。
     */
    get retryable(): boolean {
        if (this.status === 408 || this.status === 429) return true;
        if (this.status >= 500) return true;
        if (this.status === 0) return true;
        return false;
    }
}
