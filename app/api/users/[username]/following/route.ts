import { getUserByPreferredUsername } from "@/lib/db/users";
import { APPerson } from "@/lib/types/activitypub";

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

    // TODO: 关注功能尚未实现，这里使用占位数据
    const placeholderFollowing: APPerson[] = [
        {
            "@context": "https://www.w3.org/ns/activitystreams",
            type: "Person",
            id: `${url.origin}/api/users/placeholder_following_1`,
            name: "Placeholder Following 1",
        },
        {
            "@context": "https://www.w3.org/ns/activitystreams",
            type: "Person",
            id: `${url.origin}/api/users/placeholder_following_2`,
            name: "Placeholder Following 2",
        },
    ];

    const orderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/api/users/${username}/following`,
        summary: `${username}'s following`,
        totalItems: placeholderFollowing.length,
        orderedItems: placeholderFollowing,
    };

    return new Response(JSON.stringify(orderedCollection), {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
