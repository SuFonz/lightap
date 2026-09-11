import { AP_CONTEXT_PUBLIC, APActivity, APActivityType, APNote } from "@/lib/types/activitypub";
import { buildAcceptFollow, buildNote, buildOrderedCollection, convertNote } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { HttpError, UserJwtPayload } from "@/lib/types/http";
import { verify } from "@/lib/util/jwt";
import { env } from "cloudflare:workers";
import { getOrCreateNote, getReceivedNotesOf } from "@/lib/db/objects";
import { addToTimelineByAuthorFollowers } from "@/lib/db/timeline";
import { postActivity } from "@/lib/activitypub/fetch";
import { insertFollow } from "@/lib/db/follows";

export const dynamic = "force-dynamic";

const handlers: Partial<
    Record<APActivityType, (baseUrl: string, activity: APActivity) => Promise<void>>
> = {
    Create: handleCreate,
    Follow: handleFollow,
    Accept: handleAccept,
};

export async function GET(
    request: Request,
    { params }: { params: { username: string } },
) {
    const url = new URL(request.url);
    const headers = request.headers;
    const username = params.username;

    if (!username) {
        return Response.json(
            { error: "Empty username" } satisfies HttpError, 
            { status: 400 }
        );
    }

    // 验证jwt
    const authorization = headers.get("Authorization");
    if (!authorization) {
        return Response.json(
            { error: "Unauthorized" } satisfies HttpError,
            { status: 403 }
        );
    }

    const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : authorization;

    let payload: UserJwtPayload;
    try {
        payload = await verify(token, env.JWT_SECRET);
    } catch {
        return Response.json(
            { error: "Unauthorized" } satisfies HttpError,
            { status: 403 }
        );
    }

    // 用户名与路径不匹配
    if (params.username != payload.username) {
        return Response.json(
            { error: "Unauthorized" } satisfies HttpError,
            { status: 403 }
        );
    }

    const notes = await getReceivedNotesOf(params.username, 10);
    const apNotes: APNote[] = [];

    for (const note of notes) {
        const apNote = convertNote(note.url, note.name ?? "", note.content);
        if (apNote) {
            apNotes.push(apNote);
        }
    }

    const orderedCollection = buildOrderedCollection(url.origin, username, apNotes, "inbox");
    if (!orderedCollection) {
        return Response.json(
            { error: "Server error" } satisfies HttpError,
            { status: 500 }
        );
    }

    return Response.json(orderedCollection, {
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}

export async function POST(
    request: Request,
    { params }: { params: { username: string } },
) {
    const url = new URL(request.url);
    const username = params.username;
    const activity = await request.json<APActivity>();

    console.log("outbox POST request:", activity);

    if (!username) {
        return Response.json(
            { error: "Empty username" } satisfies HttpError,
            { status: 400 }
        );
    }

    const user = await getUserByPreferredUsername(username);
    if (!user) {
        return Response.json(
            { error: "User not found" } satisfies HttpError,
            { status: 404 }
        );
    }

    try {
        const handler = handlers[activity.type];
        if (!handler) {
            return Response.json(
                { error: "Unsupported activity type" } satisfies HttpError,
                { status: 400 }
            );
        }

        if (handler) {
            await handler(url.origin, activity);
        }

        return Response.json(null, {
            status: 202,
            headers: {
                "Content-Type": "application/activity+json",
                Location: "xxx" // TODO:
            },
        });
    } catch (e: unknown) {}

    return Response.json(
        { error: "Server error" } satisfies HttpError,
        { status: 500 }
    );
}

// 公开 / 未列出（to/cc 含 #Public）才 fan-out，避免私信进关注线
function isPublicActivity(activity: APActivity): boolean {
    const recipients = [...(activity.to ?? []), ...(activity.cc ?? [])];
    return recipients.includes(AP_CONTEXT_PUBLIC);
}

async function handleCreate(baseUrl: string, activity: APActivity): Promise<void> {
    const actor = activity.actor;
    const note = activity.object as APNote;
    const actorUrl = typeof(actor) === "string" ? actor : actor.id;

    const objectId = await getOrCreateNote(
        note.id,
        actorUrl,
        note.name ?? null,
        note.content,
        note.to ?? activity.to ?? null,
        note.cc ?? activity.cc ?? null
    );

    await insertActivity(
        "Create",
        actorUrl,
        objectId,
        activity.to ?? [],
        activity.cc ?? []
    );

    // 关注线：给「关注了该作者」的本站用户插行（仅公开/未列出的帖）
    if (isPublicActivity(activity)) {
        await addToTimelineByAuthorFollowers(objectId, Date.now(), actorUrl);
    }
}

async function handleFollow(baseUrl: string, activity: APActivity): Promise<void> {
    const selfActor = activity.object;
    const targetActor = activity.actor;
    const selfId = typeof(selfActor) === "string" ? selfActor : selfActor.id;
    const targetId = typeof(targetActor) === "string" ? targetActor : targetActor.id;

    const acceptFollow = buildAcceptFollow(baseUrl, selfId, activity);
    
    const success = await postActivity(selfId, targetId, acceptFollow);
    if (success) {
        await insertFollow(targetId, selfId);
    }
}

// 我方 Follow 被对方接受：对方回 Accept{object: 原Follow}，落库关注关系
async function handleAccept(baseUrl: string, activity: APActivity): Promise<void> {
    console.log("handleAccept:", activity);
    const inner = activity.object as APActivity | undefined;
    if (!inner || inner.type !== "Follow") {
        return;
    }

    const followerId = typeof(inner.actor) === "string" ? inner.actor : inner.actor?.id;
    const followingId = typeof(inner.object) === "string" ? inner.object : inner.object?.id;
    if (!followerId || !followingId) {
        return;
    }

    await insertFollow(followerId, followingId);
}
