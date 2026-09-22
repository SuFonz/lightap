import { APActivity, APActor, APNote, APObject, APOrderedCollection } from "@/src/activitypub/ap";
import { getActor, getWebfinger, postInbox } from "@/src/activitypub/network";
import { buildActivity, convertActorUrlToMainKey } from "@/src/activitypub/tools";
import { activities, follows, notes, users } from "@/src/db/schema";
import { upsertRemoteUser } from "@/src/db/users";
import { HeaderSource, verifyActivityPubRequest, verifyRfc9421 } from "@/src/utils/signature";
import { and, eq } from "drizzle-orm";
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

    // 处理活动；失败时返回 500，让发送方重投
    try {
        await handleActivity(request, params, body);
    } catch {
        return Response.json({
            error: "Failed to handle activity.",
        }, {
            status: 500,
        });
    }

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

                // 远程 Actor 落库，feed 才能显示作者信息
                await upsertRemoteUser(rmActor);

                console.log(activity);

                // 存入数据库
                await db.insert(follows).values({
                    follower: user.actorUrl,
                    following: rmActor.id,
                });

                // Accept 的 object 是之前发出去的 Follow 活动
                const followAct = (await db.select().from(activities).where(eq(activities.uri, obj.id)))[0];

                await db.insert(activities).values({
                    uri: activity.id,
                    type: activity.type,
                    actor: activity.actor,
                    objectId: followAct.id,
                    objectType: "Follow",
                });


                break;
            }
            case "Create": {
                console.log(activity);

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

                // 远程 Actor 落库，feed 才能显示作者信息
                await upsertRemoteUser(rmActor);

                // 已经收过这条 Note 就跳过（ActivityPub 会重投同一条活动）
                const existing = (await db.select().from(notes).where(eq(notes.uri, obj.id)))[0];
                if (existing) {
                    break;
                }

                // 保留远端原始发布时间；解析失败则用当前时间
                const publishedMs = obj.published ? new Date(obj.published).getTime() : NaN;
                const createdAt = Number.isFinite(publishedMs)
                    ? Math.floor(publishedMs / 1000)
                    : Math.floor(Date.now() / 1000);

                // 存入数据库
                await db.insert(notes).values({
                    uri: obj.id,
                    uuid: crypto.randomUUID(),
                    actor: activity.actor,
                    content: obj.content,
                    inReplyTo: obj.inReplyTo ?? null,
                    createdAt,
                });

                break;
            }
            case "Follow": {
                // 获取 User (getActor 签名用)
                const user = (await db.select().from(users).where(eq(users.username, username)))[0];

                // 获取远程 Actor 公钥
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

                // 远程 Actor 落库，feed 才能显示作者信息
                await upsertRemoteUser(rmActor);

                // 存入数据库：远程用户关注本站用户
                await db.insert(follows).values({
                    follower: rmActor.id,
                    following: user.actorUrl,
                }).onConflictDoNothing();

                // 回一个 Accept 给远程用户
                const url = new URL(request.url);
                const accept = buildActivity(url, crypto.randomUUID(), "Accept", user.actorUrl, activity);
                const userMkUrl = convertActorUrlToMainKey(user.actorUrl);
                await postInbox(rmActor.inbox, user.privateKey, userMkUrl, accept);

                break;
            }
            case "Undo": {
                // 获取 User (getActor 签名用)
                const user = (await db.select().from(users).where(eq(users.username, username)))[0];

                // 获取远程 Actor 公钥
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

                // Undo 的 object 是之前那条 Follow 活动，只处理取关
                const obj = await extractObject(activity) as APActivity;
                if (obj.type !== "Follow") {
                    break;
                }

                // 从数据库中删除关注关系
                await db.delete(follows).where(
                    and(
                        eq(follows.follower, rmActor.id),
                        eq(follows.following, user.actorUrl),
                    ),
                );

                break;
            }
        }
    } catch (error: any) {
        console.log(error.message);
        throw error;
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
