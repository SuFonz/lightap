import { buildActivity, buildObjecrUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities, follows, users } from "@/src/db/schema";
import { produce } from "@/src/queue";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Body {
    username: string,
    domain: string,
    targetActorUrl: string,
}

export async function POST(request: Request) {
    // 解析参数
    const url = new URL(request.url);
    const userId = Number(request.headers.get("x-user-id"));

    // 是否本地用户
    const db = getDBClient();
    const body = await request.json<Body>();
    if (body.domain == url.host) {
        // 是：获取当前用户
        try {
            const user = (await db.select().from(users).where(eq(users.id, userId)))[0];

            // 查询另一位用户
            const target = (await db.select().from(users).where(eq(users.username, body.username)))[0];

            // 已经关注过则直接返回
            const existing = (await db.select().from(follows).where(
                and(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, target.actorUrl),
                ),
            ))[0];
            if (existing) {
                return Response.json({}, {
                    status: 200,
                });
            }

            // 当前用户的 Follow Activity 存到数据库
            const followUri = buildObjecrUri(url, crypto.randomUUID(), "Follow");
            const followAct = (await db.insert(activities).values({
                uri: followUri,
                type: "Follow",
                actor: user.actorUrl,
                objectUri: target.actorUrl,
            }).returning({ insertedId: activities.id }))[0];

            // Follows 存到数据库
            await db.insert(follows).values({
                follower: user.actorUrl,
                following: target.actorUrl,
            });

            // 目标的 Accept Activity：object 是上面那条 Follow 活动
            const acceptUri = buildObjecrUri(url, crypto.randomUUID(), "Accept");
            const acceptAct = (await db.insert(activities).values({
                uri: acceptUri,
                type: "Accept",
                actor: target.actorUrl,
                objectId: followAct.insertedId,
                objectType: "Follow",
            }));

        } catch (error: any) {
            console.log(error.message);
            return Response.json({
                error: "Server internal error.",
            }, {
                status: 500,
            });
        }

    } else {
        try {
            // 否：获取当前用户
            const user = (await db.select().from(users).where(eq(users.id, userId)))[0]

            // 构建 Follow Activity 并存入数据库
            const follow = buildActivity(url, crypto.randomUUID(), "Follow", user.actorUrl, body.targetActorUrl);
            const dbAct = (await db.insert(activities).values({
                uri: follow.id,
                type: "Follow",
                actor: user.actorUrl,
                objectUri: body.targetActorUrl,
            }).returning({ insertedId: activities.id }))[0];

            // 丢进队列异步投递
            await produce({ targetActor: body.targetActorUrl, activityId: dbAct.insertedId });

        } catch (error: any) {
            console.log(error.message);
            return Response.json({
                error: "Server internal error.",
            }, {
                status: 500,
            });
        }
    }

    return Response.json({}, {
        status: 200,
    })
}
