import { APActivity, APActor, APNote, APOrderedCollection } from "@/src/activitypub/ap";
import { getActor, postInbox } from "@/src/activitypub/network";
import { buildActivity, convertActorUrlToMainKey } from "@/src/activitypub/tools";
import { activities, announces, follows, likes, notes, users } from "@/src/db/schema";
import { storeRemoteActor } from "@/src/lib/actor";
import { parseAttachments, serializeAttachments } from "@/src/lib/attachments";
import { toNoteListItems } from "@/src/lib/notes";
import { createNotification } from "@/src/lib/notify";
import { publishEvent } from "@/src/realtime/sse";
import { HeaderSource, verifyActivityPubRequest, verifyRfc9421 } from "@/src/utils/signature";
import { and, eq, inArray } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

/** D1 单条 SQL 的绑定参数上限是 100，批量查询时按这个粒度分批 */
const BOUND_PARAMS_PER_QUERY = 90;

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
    const url = new URL(request.url);

    console.log(activity);
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
                console.log(activity);

                // 先拉取远程 Actor、验证签名并落库（feed 才能显示作者信息）
                const { remoteUser } = await resolveRemoteActor(request, activity, username);

                // 提取对象
                const obj = await extractObject(activity) as APNote;

                console.log(obj.attachment);

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
                // 远程帖子的附件（图片/视频/音频/文件）单独解析后存成 JSON，
                // 解析失败或没有附件时存 null，不影响帖子本身入库
                const attachments = parseAttachments(obj.attachment);
                const newNote = (await db.insert(notes).values({
                    uri: obj.id,
                    uuid: crypto.randomUUID(),
                    actor: activity.actor,
                    content: obj.content,
                    inReplyTo: obj.inReplyTo ?? null,
                    attachment: serializeAttachments(attachments),
                    createdAt,
                }).returning())[0];

                // 回复的话先找到父帖
                const parent = obj.inReplyTo
                    ? (await db.select().from(notes).where(eq(notes.uri, obj.inReplyTo)))[0]
                    : undefined;

                // 如果是回复本站用户的帖子，给被回复者写一条 Reply 通知
                if (remoteUser && parent) {
                    const recipient = await findLocalUser(parent.actor, url.host);
                    if (recipient) {
                        await createNotification({
                            userId: recipient.id,
                            actorId: remoteUser.id,
                            type: "Reply",
                            noteId: newNote.id,
                        });
                    }
                }

                // 实时推送
                if (obj.inReplyTo) {
                    // 回复：不进时间线，只让父帖评论数 +1
                    if (parent) {
                        await publishEvent({
                            type: "reply.created",
                            data: { parentUuid: parent.uuid, actorUsername: remoteUser?.username ?? "" },
                        }, { type: "all" });
                    }
                } else {
                    // 顶层帖：广播给所有人（含访客）+ 定向推给作者的本站粉丝
                    const [item] = await toNoteListItems([newNote]);
                    if (item) {
                        await publishEvent({ type: "note.created", data: item }, { type: "all" });

                        if (remoteUser) {
                            const followerActorUrls = (await db.select({ follower: follows.follower })
                                .from(follows).where(eq(follows.following, remoteUser.actorUrl)))
                                .map(f => f.follower);
                            // D1 单条查询最多 100 个绑定参数，粉丝多时分批查本站用户
                            const userIds: number[] = [];
                            for (let i = 0; i < followerActorUrls.length; i += BOUND_PARAMS_PER_QUERY) {
                                const chunk = followerActorUrls.slice(i, i + BOUND_PARAMS_PER_QUERY);
                                const localFollowers = await db.select({ id: users.id }).from(users).where(
                                    and(
                                        inArray(users.actorUrl, chunk),
                                        eq(users.domain, url.host),
                                    ),
                                );
                                userIds.push(...localFollowers.map(u => u.id));
                            }
                            if (userIds.length > 0) {
                                await publishEvent({ type: "following.note", data: item }, { type: "users", userIds });
                            }
                        }
                    }
                }

                break;
            }
            case "Follow": {
                const { user, actor, remoteUser } = await resolveRemoteActor(request, activity, username);

                // 存入数据库：远程用户关注本站用户
                const inserted = await db.insert(follows).values({
                    follower: actor.id,
                    following: user.actorUrl,
                }).onConflictDoNothing().returning();

                // 给被关注的本站用户写一条 Follow 通知（重复投递不重复通知）
                if (inserted.length > 0 && remoteUser) {
                    await createNotification({
                        userId: user.id,
                        actorId: remoteUser.id,
                        type: "Follow",
                    });
                }

                // 回一个 Accept 给远程用户
                const accept = buildActivity({
                    url,
                    uuid: crypto.randomUUID(),
                    type: "Accept",
                    actor: user.actorUrl,
                    object: activity,
                });
                const userMkUrl = convertActorUrlToMainKey(user.actorUrl);
                await postInbox(actor.inbox, user.privateKey, userMkUrl, accept);

                break;
            }
            case "Like": {
                // 先拉取远程 Actor、验证签名并落库
                const { remoteUser } = await resolveRemoteActor(request, activity, username);

                // Like 的 object 是被点赞的 Note（本站 Note 的 uri）
                const objectUri = typeof activity.object === "string" ? activity.object : activity.object.id;
                const note = (await db.select().from(notes).where(eq(notes.uri, objectUri)))[0];
                if (!note || !remoteUser) {
                    break;
                }

                // 存入数据库（ActivityPub 会重投，uri 唯一，重复插入忽略）
                const inserted = await db.insert(likes).values({
                    uri: activity.id,
                    userId: remoteUser.id,
                    noteId: note.id,
                }).onConflictDoNothing().returning();

                // 给被点赞帖子的作者写一条 Like 通知（仅本站用户，重复投递不重复通知）
                if (inserted.length > 0) {
                    const recipient = await findLocalUser(note.actor, url.host);
                    if (recipient) {
                        await createNotification({
                            userId: recipient.id,
                            actorId: remoteUser.id,
                            type: "Like",
                            noteId: note.id,
                        });
                    }

                    // 实时：让正在看这条帖子的人点赞数 +1
                    await publishEvent({
                        type: "like.created",
                        data: { noteUuid: note.uuid },
                    }, { type: "all" });
                }

                break;
            }
            case "Announce": {
                // 远程用户转发了某条帖子。
                //
                // 与 Like 的区别：转发会进入时间线，所以要能定位到**被转发的原帖**。
                // 如果原帖不在本地库里（例如转的是另一台实例的帖子），
                // 这里只记录转发关系、不抓取内容——抓取需要额外的网络请求，
                // 属于「按需补全」，不在 inbox 的同步路径里做。
                const { remoteUser } = await resolveRemoteActor(request, activity, username);

                // object 是被转发的 Note（通常是一个 uri 字符串，也可能内嵌对象）
                const objectUri = typeof activity.object === "string" ? activity.object : activity.object?.id;
                if (!objectUri || !remoteUser) {
                    break;
                }

                const note = (await db.select().from(notes).where(eq(notes.uri, objectUri)))[0];
                if (!note) {
                    // 原帖不在本地：暂不记录（避免时间线出现空壳转发）
                    break;
                }

                // 已删除的帖子不接受转发
                if (note.deletedAt) {
                    break;
                }

                // 存入数据库（ActivityPub 会重投，同一用户+帖子的唯一约束保证幂等）
                const inserted = await db.insert(announces).values({
                    uri: activity.id,
                    userId: remoteUser.id,
                    noteId: note.id,
                }).onConflictDoNothing().returning();

                if (inserted.length > 0) {
                    // 给被转发帖子的作者写一条 Announce 通知（仅本站用户）
                    const recipient = await findLocalUser(note.actor, url.host);
                    if (recipient) {
                        await createNotification({
                            userId: recipient.id,
                            actorId: remoteUser.id,
                            type: "Announce",
                            noteId: note.id,
                        });
                    }

                    // 实时：让这条转发出现在时间线上
                    try {
                        const [item] = await toNoteListItems(
                            [note],
                            undefined,
                            new Map([[note.id, {
                                username: remoteUser.username,
                                displayName: remoteUser.displayName ?? remoteUser.username,
                                avatarUrl: remoteUser.avatarUrl ?? "",
                                domain: remoteUser.domain,
                                announceUri: activity.id,
                                // 转发时间：前端据此把它当作「最新」排到最前
                                createdAt: inserted[0].createdAt ?? Math.floor(Date.now() / 1000),
                            }]]),
                        );
                        if (item) {
                            await publishEvent({
                                type: "announce.created",
                                data: item,
                            }, { type: "all" });
                        }
                    } catch {
                        // 实时推送失败不影响转发落库
                    }
                }

                break;
            }
            case "Delete": {
                // 先拉取远程 Actor、验证签名并落库
                const { actor } = await resolveRemoteActor(request, activity, username);

                // object 可能是 Tombstone / Note（对象），也可能只是被删对象的 uri
                const objectUri = typeof activity.object === "string" ? activity.object : activity.object.id;
                if (!objectUri) {
                    break;
                }

                const note = (await db.select().from(notes).where(eq(notes.uri, objectUri)))[0];
                if (!note) {
                    break;
                }

                // 只有作者本人才能删自己的帖子
                if (note.actor !== actor.id) {
                    break;
                }

                // 软删除（本地也标记删除，feed / 线程即不再展示）
                // 不清理 likes / announces：软删除只是「不再展示」，
                // 展示层都带 deletedAt 过滤，关联数据自然也不会出现。
                await db.update(notes).set({
                    deletedAt: Math.floor(Date.now() / 1000),
                }).where(eq(notes.id, note.id));

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

                // 取消转发：Undo Announce（object 是内嵌 Announce，或只是它的 uri）
                if (obj.type === "Announce") {
                    const announceUri = typeof activity.object === "string" ? activity.object : obj.id;
                    if (announceUri) {
                        const removed = await db.delete(announces)
                            .where(eq(announces.uri, announceUri))
                            .returning();
                        // 让时间线撤掉这条转发
                        if (removed.length > 0) {
                            const note = (await db.select().from(notes)
                                .where(eq(notes.id, removed[0].noteId)))[0];
                            if (note) {
                                await publishEvent({
                                    type: "announce.removed",
                                    data: { noteUuid: note.uuid, actorUsername: actor.preferredUsername },
                                }, { type: "all" });
                            }
                        }
                    }
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
    const url = new URL(request.url);
    const db = getDBClient();

    // 获取 User (getActor 签名用)
    const user = (await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.domain, url.host),
        )
    ))[0];

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

    // 落库后再取回远程 Actor 的本地 users 行（通知的 actorId 要用）
    const remoteUser = (await db.select().from(users).where(eq(users.actorUrl, actor.id)))[0];

    return { user, actor, remoteUser };
}

/** 按 actorUrl 找本站用户；不存在或 domain 不是本站时返回 undefined */
async function findLocalUser(actorUrl: string, host: string) {
    const db = getDBClient();
    const user = (await db.select().from(users).where(eq(users.actorUrl, actorUrl)))[0];
    if (!user || user.domain !== host) {
        return undefined;
    }
    return user;
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
