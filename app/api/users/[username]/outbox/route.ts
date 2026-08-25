import { env } from "cloudflare:workers";
import { verify } from "@/lib/util/jwt";
import { UserJwtPayload } from "@/lib/types/http"
import { getUserByPreferredUsername } from "@/lib/db/users";
import { APActivity, APCreate, APNote } from "@/lib/types/activitypub";
import { getNotesByPreferredUsername, insertNote } from "@/lib/db/objects";
import { buildNote, buildOrderedCollection } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";

export const dynamic = "force-dynamic";

const handlers: Record<string, (activity: APActivity) => Promise<void>> = {
    Create: handleCreate,
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
        const apNote = buildNote(url.origin, note.name ?? "", note.content, note.id);
        if (apNote) {
            apNotes.push(apNote);
        }
    }

    const orderedCollection = buildOrderedCollection(url.origin, username, apNotes);
    if (!orderedCollection) {
        return new Response("Server error", {
            status: 500
        });
    }

    return new Response(JSON.stringify(orderedCollection), {
        status: 200,
        headers: {
            "Content-Type": "application/jrd+json",
        }
    });
}

export async function POST(request: Request) {
    const headers = await request.headers;
    const activity = await request.json<APActivity>();
    
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

    // 查询用户
    const user = getUserByPreferredUsername(payload.username);
    if (!user) {
        return new Response("User not found", {
            status: 404
        });
    }

    try {
        // 处理 Activity
        await handlers[activity.type](activity);

        return new Response(null, {
            status: 201,
            headers: {
                "Content-Type": `application/ld+json; profile="https://www.w3.org/ns/activitystreams"`,
                Location: "xxx", // TODO:
            }
        });
    } catch (e: unknown) {}

    return new Response(null, {
        status: 500,
    });
}

async function handleCreate(activity: APActivity) {
    const activityCreate = activity as APCreate;
    const actor = activityCreate.actor;
    const note = activityCreate.object;

    const noteId = await insertNote(actor.id, note.name, note.content);

    await insertActivity(activity.type, actor.id, noteId);
}

