import { APActivity, APActor, APNote, APObject, APOrderedCollection } from "@/src/activitypub/ap";
import { getActor, getWebfinger, postInbox } from "@/src/activitypub/network";
import { buildActivity, convertActorUrlToMainKey } from "@/src/activitypub/tools";
import { activities, follows, notes, users } from "@/src/db/schema";
import { HeaderSource, verifyActivityPubRequest, verifyRfc9421 } from "@/src/utils/signature";
import { eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

interface Params {
    username: string,
}

export async function GET(request: Request) {
    // 返回占位符
    const data: APOrderedCollection = {
        id: "",
        summary: "",
        type: "OrderedCollection",
        totalItems: 0,
        orderedItems: [],
    };

    return Response.json(data, {
        status: 200
    });
}

// 远程服务器 POST 到 /users/[username]/inbox
export async function POST(request: Request, { params }: { params: Params }) {
    // 解析参数
    const url = new URL(request.url);
    const body = await request.json<APActivity>();

    // 处理活动
    await handleActivity(request, params, body);

    return Response.json({}, {
        status: 200,
    });
}

async function handleActivity(request: Request, params: Params, activity: APActivity) {
    const db = getDBClient();
    const username = params.username;
    const type = activity.type;
    try {
        switch (type) {
            case "Accept": {
                // 提取对象
                const obj = await extractObject(activity) as APActivity;

                // 获取 User (getActor 签名用)
                const user = (await db.select().from(users).where(eq(users.username, username)))[0];
                
                // 获取远程 Actor 公钥 (如果已经存数据库了可以从数据库里提取)
                const rmRes = await getActor(activity.actor, user.privateKey, convertActorUrlToMainKey(user.actorUrl));
                if (!rmRes.ok) {
                    throw new Error("Remote user not found.");
                }
                const rmActor = await rmRes.json<APActor>();

                // 用公钥验证
                const success = await tryVerifySignature(
                    request.method, 
                    request.url, 
                    request.headers, 
                    rmActor.publicKey.publicKeyPem,
                    rmActor.publicKey.id,
                );
                if (!success) {
                    throw new Error("Sinature is invalid.");
                }

                console.log(activity);

                // 存入数据库
                const followsIns = (await db.insert(follows).values({
                    follower: user.actorUrl,
                    following: rmActor.id,
                }).returning({ insertedId: follows.id }))[0];

                const activityIns = (await db.insert(activities).values({
                    uri: activity.id,
                    type: activity.type,
                    actor: activity.actor,
                    objectId: followsIns.insertedId,
                }).returning({ insertedId: activities.id }));


                break;
            }
            case "Create": {
                // 提取对象
                const obj = await extractObject(activity) as APNote;

                // 获取 User (getActor 签名用)
                const user = (await db.select().from(users).where(eq(users.username, username)))[0];

                // 获取远程 Actor 公钥 (如果已经存数据库了可以从数据库里提取)
                const rmRes = await getActor(activity.actor, user.privateKey, convertActorUrlToMainKey(user.actorUrl));
                if (!rmRes.ok) {
                    throw new Error("Remote user not found.");
                }
                const rmActor = await rmRes.json<APActor>();

                // 用公钥验证
                const success = await tryVerifySignature(
                    request.method, 
                    request.url, 
                    request.headers, 
                    rmActor.publicKey.publicKeyPem,
                    rmActor.publicKey.id,
                );
                if (!success) {
                    throw new Error("Sinature is invalid.");
                }

                // 存入数据库
                const noteIns = (await db.insert(notes).values({
                    uri: obj.id,
                    actor: activity.actor,
                    content: obj.content,
                    
                }))

                break;
            }
        }
    } catch (error: any) {
        console.log(error.message);
    }

}

async function extractObject(activity: APActivity) {
    if (typeof activity.object === "object") {
        return activity.object;
    }
    return activity;
}

async function tryVerifySignature(
    method: string,
    url: string,
    headers: HeaderSource,
    publicKey: string,
    expectedKeyId: string,
) {
    try {
        // legacy
        const apValid = await verifyActivityPubRequest({
            method,
            url,
            headers,
            publicKey,
            expectedKeyId,
        });

        if (apValid) {
            return true;
        }
    } catch(error: any) {}

    try {
        // RFC 9421
        const rfcValid = await verifyRfc9421({
            method,
            url,
            headers,
            publicKey,
        })

        if (rfcValid) {
            return true;
        }
    } catch (error: any) {}

    return false;
}
