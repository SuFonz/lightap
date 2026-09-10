import { buildActor } from "@/lib/activitypub/tools";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { HttpError } from "@/lib/types/http";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: { username: string } },
) {
    const url = new URL(request.url);
    const username = params.username;

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

    const actor = buildActor(
        url.origin,
        user.name,
        user.preferred_username,
        user.summary,
        user.public_key_pem,
    );
    if (!actor) {
        return Response.json(
            { error: "Server error" } satisfies HttpError,
            { status: 500 }
        );
    }

    return Response.json(actor, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
