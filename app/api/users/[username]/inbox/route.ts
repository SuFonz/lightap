import { APActivity, APCreate, APNote } from "@/lib/types/activitypub";
import { buildNote, buildOrderedCollection } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { UserJwtPayload } from "@/lib/types/http";
import { verify } from "@/lib/util/jwt";
import { env } from "cloudflare:workers";
import { insertNote } from "@/lib/db/objects";

export const dynamic = "force-dynamic";

const handlers: Record<string, (activity: APActivity) => Promise<void>> = {
    Create: handleCreate,
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

    const notes = await getReceivedNotes(10);
    const apNotes: APNote[] = [];

    for (const note of notes) {
        const apNote = buildNote(url.origin, note.name, note.content, note.id);
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

    let activity: APActivity;
    try {
        activity = await request.json<APActivity>();
    } catch {
        return new Response("Invalid JSON", {
            status: 400,
        });
    }

    const handler = handlers[activity.type];
    if (!handler) {
        return new Response("Unsupported activity type", {
            status: 400,
        });
    }

    try {
        await handler(activity);

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

async function handleCreate(activity: APActivity): Promise<void> {
    const createActivity = activity as APCreate;
    const actor = createActivity.actor;
    const note = createActivity.object;

    const noteId = await insertNote(note.id, note.name, note.content);

    await insertActivity("Create", actor.id, noteId);

}
