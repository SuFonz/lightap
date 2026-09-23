import { APPerson } from "@/src/activitypub/ap";
import { users } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
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

    // 查询用户 followering 数量

    // TODO: 关注功能尚未实现，这里使用占位数据
    const placeholderFollowing: APPerson[] = [
        {
            type: "Person",
            id: `${url.origin}/users/placeholder_following_1`,
            name: "Placeholder Following 1",
        },
        {
            type: "Person",
            id: `${url.origin}/users/placeholder_following_2`,
            name: "Placeholder Following 2",
        },
    ];

    const orderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/users/${username}/following`,
        summary: `${username}'s following`,
        totalItems: placeholderFollowing.length,
        orderedItems: placeholderFollowing,
    };

    return Response.json(orderedCollection, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
