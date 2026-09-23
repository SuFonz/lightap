import type { APActivityType, APObjectType } from "@/src/activitypub/ap";
import { buildObjecrUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities } from "@/src/db/schema";
import { produce } from "@/src/queue";

export interface DispatchActivityInput {
    type: APActivityType;
    /** 发起活动的一方（本站用户的 actorUrl） */
    actor: string;
    /** 投递目标：远程 Actor 的链接 */
    targets: string[];
    /** 可选：显式指定活动 uri（默认按 type + 随机 uuid 生成） */
    uri?: string;
    /** object 是链接时使用 */
    objectUri?: string;
    /** object 是本地对象时使用（连同 objectType） */
    objectId?: number;
    objectType?: APObjectType;
}

/**
 * 记录一条本地活动，并把投递任务丢进队列异步送达各个远端收件人。
 *
 * 只保存活动的元信息（uri / type / actor / object 引用），
 * 真正的 ActivityPub 报文在队列消费时再根据这些字段重建（见 src/queue）。
 * 返回该活动的 uri，远端可用它引用这条活动。
 */
export async function dispatchActivity(url: URL, input: DispatchActivityInput) {
    const uri = input.uri ?? buildObjecrUri({ url, uuid: crypto.randomUUID(), type: input.type });

    const inserted = (await getDBClient().insert(activities).values({
        uri,
        type: input.type,
        actor: input.actor,
        objectUri: input.objectUri ?? null,
        objectId: input.objectId ?? null,
        objectType: input.objectType ?? null,
    }).returning({ insertedId: activities.id }))[0];

    await Promise.all(
        input.targets.map(targetActor => produce({ targetActor, activityId: inserted.insertedId })),
    );

    return {
        id: inserted.insertedId,
        uri,
    };
}
