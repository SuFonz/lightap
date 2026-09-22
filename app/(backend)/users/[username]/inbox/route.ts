import { APActivity, APActor, APNote, APOrderedCollection } from "@/src/activitypub/ap";
import { getActor, postInbox } from "@/src/activitypub/network";
import { buildActivity, convertActorUrlToMainKey } from "@/src/activitypub/tools";
import { activities, follows, likes, notes, users } from "@/src/db/schema";
import { storeRemoteActor } from "@/src/lib/actor";
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
                const { user, actor } = await resolveRemoteActor(request, activity, username);

                // 提取对象：Accept 的 object 是之前发出去的 Follow 活动
                const obj = await extractObject(activity) as APActivity;

                // 存入数据库：远程用户接受了关注，建立关注关系
                await db.insert(follows).values({
                    follower: user.actorUrl,
                    following: actor.id,
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
                // 先拉取远程 Actor、验证签名并落库（feed 才能显示作者信息）
                await resolveRemoteActor(request, activity, username);

                // 提取对象
                const obj = await extractObject(activity) as APNote;

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
                const { user, actor } = await resolveRemoteActor(request, activity, username);

                // 存入数据库：远程用户关注本站用户
                await db.insert(follows).values({
                    follower: actor.id,
                    following: user.actorUrl,
                }).onConflictDoNothing();

                // 回一个 Accept 给远程用户
                const url = new URL(request.url);
                const accept = buildActivity(url, crypto.randomUUID(), "Accept", user.actorUrl, activity);
                const userMkUrl = convertActorUrlToMainKey(user.actorUrl);
                await postInbox(actor.inbox, user.privateKey, userMkUrl, accept);

                break;
            }
            case "Like": {
                // 先拉取远程 Actor、验证签名并落库
                const { actor } = await resolveRemoteActor(request, activity, username);

                // Like 的 object 是被点赞的 Note（本站 Note 的 uri）
                const objectUri = typeof activity.object === "string" ? activity.object : activity.object.id;
                const note = (await db.select().from(notes).where(eq(notes.uri, objectUri)))[0];
                if (!note) {
                    break;
                }

                // 点赞者：远程 Actor 已落库，按 actorUrl 取本地 users 行
                const liker = (await db.select().from(users).where(eq(users.actorUrl, actor.id)))[0];
                if (!liker) {
                    break;
                }

                // 存入数据库（ActivityPub 会重投，uri 唯一，重复插入忽略）
                await db.insert(likes).values({
                    uri: activity.id,
                    userId: liker.id,
                    noteId: note.id,
                }).onConflictDoNothing();

                break;
            }
            case "Undo": {
                const { user, actor } = await resolveRemoteActor(request, activity, username);

                // object 可能是内嵌活动（带 type），也可能只是活动 uri
                const obj = await extractObject(activity) as APActivity;

                // 取关：Undo Follow
                if (obj.type === "Follow") {
                    await db.delete(follows).where(
                        and(
                            eq(follows.follower, actor.id),
                            eq(follows.following, user.actorUrl),
                        ),
                    );
                    break;
                }

                // 取消点赞：Undo Like（object 是内嵌 Like，或只是 Like 的 uri）
                const likeUri = typeof activity.object === "string"
                    ? activity.object
                    : obj.type === "Like" ? obj.id : "";
                if (likeUri) {
                    await db.delete(likes).where(eq(likes.uri, likeUri));
                }

                break;
            }
        }
    } catch (error: any) {
        console.log(error.message);
        throw error;
    }

}

/**
 * 拉取来件的远程 Actor、用其公钥验证签名，并落库。
 *
 * 收件箱的每个活动分支都需要这三步，统一收在这里：
 * 1. 取本站用户（作为 getActor 的签名身份）
 * 2. 请求远程 Actor 文档并解析
 * 3. 验签 + 落库（本地远程用户信息，供 feed 展示作者）
 */
async function resolveRemoteActor(request: Request, activity: APActivity, username: string) {
    const db = getDBClient();

    // 获取 User (getActor 签名用)
    const user = (await db.select().from(users).where(eq(users.username, username)))[0];

    // TODO: 远程 Actor 如果已经存数据库了可以从数据库里提取

    // 获取远程 Actor
    const rmRes = await getActor(activity.actor, user.privateKey, convertActorUrlToMainKey(user.actorUrl));
    if (!rmRes.ok) {
        throw new Error("Remote user not found.");
    }
    const actor = await rmRes.json<APActor>();

    // 用公钥验证来件签名
    const success = await tryVerifySignature(
        request.method,
        request.url,
        request.headers,
        actor.publicKey.publicKeyPem,
        actor.publicKey.id,
    );
    if (!success) {
        throw new Error("Sinature is invalid.");
    }

    // 远程 Actor 落库，feed 才能显示作者信息
    await storeRemoteActor(actor);

    return { user, actor };
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
    } catch (error: any) { }

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
    } catch (error: any) { }

    return false;
}
