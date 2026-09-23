import { APPerson } from "@/src/activitypub/ap";
import { follows, users } from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

interface Params {
    username: string
}

export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 解析参数
    const url = new URL(request.url);
    const username = params.username;

    // 检查用户是否存在
    const db = getDBClient();
    const result = await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.domain, url.host),
        ),
    );
    if (result.length == 0) {
        return Response.json({ 
            error: "User not found.",
        }, { 
            status: 404,
        });
    }
    const user = result[0];

    // 该用户的 followers：follows.following 是本人，follower 才是粉丝
    const followRows = await db.select().from(follows).where(eq(follows.following, user.actorUrl));
    const actorUrls = followRows.map(row => row.follower);

    // 批量取展示名，避免 N+1
    const actors = actorUrls.length > 0
        ? await db.select().from(users).where(inArray(users.actorUrl, actorUrls))
        : [];
    const nameByActor = new Map(actors.map(actor => [actor.actorUrl, actor.displayName]));

    const orderedItems: APPerson[] = actorUrls.map(actorUrl => ({
        type: "Person",
        id: actorUrl,
        name: nameByActor.get(actorUrl) ?? actorUrl,
    }));

    const orderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/users/${username}/followers`,
        summary: `${username}'s followers`,
        totalItems: orderedItems.length,
        orderedItems,
    };

    return Response.json(orderedCollection, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
