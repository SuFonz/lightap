import { getUserByActorUrl, getUserByPreferredUsername } from "@/lib/db/users";
import { APActivity, APActivityType, APNote } from "@/lib/types/activitypub";
import { getNotesByPreferredUsername, insertNote } from "@/lib/db/objects";
import { buildOrderedCollection, convertNote } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";
import { getFollowersOf, insertFollow, deleteFollow } from "@/lib/db/follows";
import { postActivity } from "@/lib/activitypub/fetch";
import { verify } from "@/lib/util/jwt";
import { env } from "cloudflare:workers";
import { HttpError, UserJwtPayload } from "@/lib/types/http";

export const dynamic = "force-dynamic";

// 发件方向：本地用户把 activity 投递到自己的 outbox，由服务器签名转发
const handlers: Partial<
    Record<
        APActivityType,
        (baseUrl: string, activity: APActivity) => Promise<void>
    >
> = {
    Create: handleCreate,
    Follow: handleFollow,
    Undo: handleUndo,
};

export async function GET(
    request: Request, 
    { params }: { params: { username: string }}
) {
    const url = new URL(request.url);
    const username = params.username;

    if (!username) {
        return new Response("Empty username", {
            status: 400,
        });
    }

    const notes = await getNotesByPreferredUsername(username, 10);
    const apNotes: APNote[] = [];

    for (const note of notes) {
        const apNote = convertNote(note.url, note.name ?? "", note.content);
        if (apNote) {
            apNotes.push(apNote);
        }
    }

    const orderedCollection = buildOrderedCollection(url.origin, username, apNotes);
    if (!orderedCollection) {
        return Response.json(
            { error: "Server error" } satisfies HttpError,
            { status: 500 }
        );
    }

    return Response.json(orderedCollection, {
        status: 200,
        headers: {
            "Content-Type": "application/jrd+json",
        }
    });
}

export async function POST(
    request: Request,
    { params }: { params: { username: string }}
) {
    const url = new URL(request.url);
    const username = params.username;

    if (!username) {
        return new Response("Empty username", {
            status: 400,
        });
    }

    // 验证jwt
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
        return new Response("Unauthorized", {
            status: 403,
        });
    }

    const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : authorization;

    let payload: UserJwtPayload;
    try {
        payload = await verify(token, env.JWT_SECRET);
    } catch {
        return new Response("Unauthorized", {
            status: 403,
        });
    }

    // 用户名与路径不匹配
    if (params.username !== payload.username) {
        return new Response("Unauthorized", {
            status: 403,
        });
    }

    // 查询用户
    const user = await getUserByPreferredUsername(params.username);
    if (!user) {
        return new Response("User not found", {
            status: 404,
        });
    }

    let activity: APActivity;
    try {
        activity = (await request.json()) as APActivity;
    } catch {
        return new Response("Invalid activity", {
            status: 400,
        });
    }


    // actor 以 JWT 身份为准，id 由服务端补全，防止伪造
    const actorId = `${url.origin}/users/${user.preferred_username}`;
    activity.actor = actorId;
    if (!activity.id) {
        activity.id = `${url.origin}/activities/${crypto.randomUUID()}`;
    }

    try {
        // 处理 Activity
        const handler = handlers[activity.type];

        if (!handler) {
            return Response.json(
                { error: "Unsupported activity type" } satisfies HttpError,
                { status: 400 }
            );
        }

        await handler(url.origin, activity);

        return Response.json(activity, {
            status: 201,
            headers: {
                "Content-Type": "application/activity+json",
                Location: activity.id,
            }
        });
    } catch (e: unknown) {
        console.error("outbox delivery failed:", e);
    }

    return Response.json(
        { error: "Server error" } satisfies HttpError,
        { status: 500 }
    );
}

async function handleCreate(baseUrl: string, activity: APActivity): Promise<void> {
    const selfActor = activity.actor;
    const selfId = typeof(selfActor) === "string" ? selfActor : selfActor.id;
    const note = activity.object as APNote;

    const noteUrl = note?.id ?? `${baseUrl}/notes/${crypto.randomUUID()}`;
    const objectId = await insertNote(
        noteUrl,
        selfId,
        note.name ?? null,
        note.content
    );

    await insertActivity(
        "Create",
        selfId,
        objectId,
        activity.to ?? [],
        activity.cc ?? []
    );

    // 把 Create 投递到所有关注者的 inbox（联邦转发）
    await deliverToFollowers(selfId, activity);
}

// 把活动投递到该 actor 的所有关注者 inbox
async function deliverToFollowers(
    selfActorUrl: string,
    activity: APActivity,
): Promise<void> {
    const user = await getUserByActorUrl(selfActorUrl);
    if (!user) return;

    const followers = await getFollowersOf(user.preferred_username);
    if (!followers || followers.length === 0) return;

    const results = await Promise.allSettled(
        followers.map((f) => {
            // 让每个收件人的 actor 出现在 cc 中，接收端才能把这条活动归属到自己
            const addressed: APActivity = {
                ...activity,
                cc: [...new Set([...(activity.cc ?? []), f.follower])],
            };
            return postActivity(selfActorUrl, f.follower, addressed);
        })
    );

    for (const result of results) {
        if (result.status === "rejected" || result.value === false) {
            console.error("deliver Create to follower failed");
        }
    }
}

// 关注：把 Follow 转发到对方的 inbox，投递成功后本地记录关注关系
async function handleFollow(baseUrl: string, activity: APActivity): Promise<void> {
    const selfActor = activity.actor;
    const targetActor = activity.object;
    const selfId = typeof(selfActor) === "string" ? selfActor : selfActor.id;
    const targetId = typeof(targetActor) === "string" ? targetActor : targetActor.id;

    const success = await postActivity(selfId, targetId, activity);
    if (!success) {
        throw new Error("Follow delivery failed");
    }

    await insertFollow(selfId, targetId);
}

// 取消关注：转发 Undo{Follow}，投递成功后删除本地关注关系
async function handleUndo(baseUrl: string, activity: APActivity): Promise<void> {
    const selfActor = activity.actor;
    const inner = activity.object;
    const innerActivity = inner as APActivity;
    // Undo 的 object 一般是内层 Follow 活动；兼容直接传目标 actor 的情况
    const targetActor =
        typeof inner === "string"
            ? inner
            : innerActivity.type === "Follow"
                ? innerActivity.object
                : inner;
    const selfId = typeof selfActor === "string" ? selfActor : selfActor.id;
    const targetId = typeof targetActor === "string" ? targetActor : targetActor.id;

    const success = await postActivity(selfId, targetId, activity);
    if (!success) {
        throw new Error("Undo delivery failed");
    }

    await deleteFollow(selfId, targetId);
}

