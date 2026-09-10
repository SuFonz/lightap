import { APActivity, APActivityType, APNote } from "@/lib/types/activitypub";
import { buildAcceptFollow, buildNote, buildOrderedCollection, convertNote } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { UserJwtPayload } from "@/lib/types/http";
import { verify } from "@/lib/util/jwt";
import { env } from "cloudflare:workers";
import { getReceivedNotesOf, insertNote } from "@/lib/db/objects";
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
        return new Response("Empty username", {
            status: 400,
        });
    }

    // 验证jwt
    const authorization = headers.get("Authorization");
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
    if (params.username != payload.username) {
        return new Response("Unauthorized", {
            status: 403,
        });
    }

    const notes = await getReceivedNotesOf(params.username, 10);
    const apNotes: APNote[] = [];

    for (const note of notes) {
        const apNote = convertNote(note.id, note.name ?? "", note.content);
        if (apNote) {
            apNotes.push(apNote);
        }
    }

    const orderedCollection = buildOrderedCollection(url.origin, username, apNotes, "inbox");
    if (!orderedCollection) {
        return new Response("Server error", {
            status: 500,
        });
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
        return new Response("Empty username", {
            status: 400,
        });
    }

    const user = await getUserByPreferredUsername(username);
    if (!user) {
        return new Response("User not found", {
            status: 404,
        });
    }

    try {
        const handler = handlers[activity.type];
        if (!handler) {
            return new Response("Unsupported activity type", {
                status: 400,
            });
        }

        if (handler) {
            await handler(url.origin, activity);
        }

        return new Response(null, {
            status: 202,
            headers: {
                "Content-Type": "application/activity+json",
                Location: "xxx" // TODO:
            },
        });
    } catch (e: unknown) {}

    return new Response(null, {
        status: 500,
    });
}

async function handleCreate(baseUrl: string, activity: APActivity): Promise<void> {
    const actor = activity.actor;
    const note = activity.object as APNote;
    const actorText = typeof(actor) === "string" ? actor : JSON.stringify(actor);

    await insertNote(
        note.id, 
        actorText,
        note.name, 
        note.content
    );

    await insertActivity(
        activity.id,
        "Create",
        actorText,
        note.id,
        activity.to ?? [],
        activity.cc ?? []
    );

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
