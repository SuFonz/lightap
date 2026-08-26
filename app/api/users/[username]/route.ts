import { buildActor } from "@/lib/activitypub/tools";
import { getUserByPreferredUsername } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export async function GET(
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

    const actor = buildActor(
        url.origin,
        user.name,
        user.preferred_username,
        user.summary,
        user.public_key_pem,
    );
    if (!actor) {
        return new Response("Server error", {
            status: 500,
        });
    }

    console.log(actor);

    return new Response(JSON.stringify(actor), {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
