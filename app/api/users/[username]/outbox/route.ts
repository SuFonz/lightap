import { getUserByPreferredUsername } from "@/lib/db/users";
import { APActivity, APActivityType, APNote } from "@/lib/types/activitypub";
import { getNotesByPreferredUsername, insertNote } from "@/lib/db/objects";
import { buildNote, buildOrderedCollection, convertNote } from "@/lib/activitypub/tools";
import { insertActivity } from "@/lib/db/activities";

export const dynamic = "force-dynamic";

const handlers: Partial<
    Record<APActivityType, (baseUrl: string, activity: APActivity) => Promise<void>>
> = {
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
        const apNote = convertNote(note.id, note.name ?? "", note.content);
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

export async function POST(
    request: Request,
    { params }: { params: { username: string }}
) {
    const url = new URL(request.url);
    const headers = await request.headers;
    const activity = await request.json<APActivity>();

    // 验证jwt
    // const authorization = headers.get("Authorization");
    // if (!authorization) {
    //     return new Response("Unauthorized", {
    //         status: 403,
    //     });
    // }

    // const token = authorization.startsWith("Bearer ")
    //     ? authorization.slice(7)
    //     : authorization;

    // let payload: UserJwtPayload;
    // try {
    //     payload = await verify(token, env.JWT_SECRET);
    // } catch {
    //     return new Response("Unauthorized", {
    //         status: 403,
    //     });
    // }

    // // 用户名与路径不匹配
    // if (params.username != payload.username) {
    //     return new Response("Unauthorized", {
    //         status: 403,
    //     });
    // }

    // 查询用户
    const user = getUserByPreferredUsername(params.username);
    if (!user) {
        return new Response("User not found", {
            status: 404
        });
    }

    try {
        // 处理 Activity
        const handler = handlers[activity.type];

        if (handler) {
            await handler(url.origin, activity);
        }

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

async function handleCreate(baseUrl: string, activity: APActivity) {
    const actor = activity.actor;
    const note = activity.object as APNote;
    const actorText = typeof(actor) === "string" ? actor : JSON.stringify(actor);

    const noteId = await insertNote(
        `${baseUrl}/notes/${crypto.randomUUID()}`, 
        actorText,
        note.name, 
        note.content
    );

    await insertActivity(
        `${baseUrl}/activities/${crypto.randomUUID()}`, 
        activity.type, 
        actorText, 
        noteId, 
        activity.to ?? [],
        activity.cc ?? []
    );
}

