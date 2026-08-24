import { getUserByUsername } from "@/lib/db/users"
import { buildWebfinger, parseResource } from "@/lib/activitypub/object";

export const dynamic = "force-dynamic";

/**
 * /.well-known/webfinger
 */
export async function GET(request: Request) {
    const url = new URL(request.url);

    const resource = url.searchParams.get("resource");

    if (!resource) {
        return new Response("Missing resource", {
            status: 400,
        });
    }

    const [username, domain] = parseResource(resource);

    const user = await getUserByUsername(username);

    if (!user) {
        return new Response("User not found", {
            status: 404,
        });
    }

    const webfinger = buildWebfinger(url.origin, username, domain);

    return Response.json(webfinger, {
        headers: {
            "Content-Type": "application/jrd+json",
        }
    });
}