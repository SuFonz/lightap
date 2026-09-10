import { getUserByPreferredUsername } from "@/lib/db/users";
import { APPerson } from "@/lib/types/activitypub";
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

    // TODO: 关注功能尚未实现，这里使用占位数据
    const placeholderFollowers: APPerson[] = [
        {
            type: "Person",
            id: `${url.origin}/users/placeholder_follower_1`,
            name: "Placeholder Follower 1",
        },
        {
            type: "Person",
            id: `${url.origin}/users/placeholder_follower_2`,
            name: "Placeholder Follower 2",
        },
    ];

    const orderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/users/${username}/followers`,
        summary: `${username}'s followers`,
        totalItems: placeholderFollowers.length,
        orderedItems: placeholderFollowers,
    };

    return Response.json(orderedCollection, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
