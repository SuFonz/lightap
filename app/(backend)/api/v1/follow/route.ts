import { buildObjecrUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities, follows, users } from "@/src/db/schema";
import { dispatchActivity } from "@/src/lib/activity";
import { resolveRequestUser } from "@/src/lib/auth";
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
    const db = getDBClient();
    const body = await request.json<Body>();

    try {
        const user = await resolveRequestUser(request);
        if (!user) {
            return Response.json({
                error: "Unauthorized.",
            }, {
                status: 401,
            });
        }

        // 是否本地用户
        if (body.domain == url.host) {
            // 是：查询另一位用户（限定本站，避免命中同名远程用户）
            const target = (await db.select().from(users).where(
                and(
                    eq(users.username, body.username),
                    eq(users.domain, url.host),
                ),
            ))[0];

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
            const followUri = buildObjecrUri({ url, uuid: crypto.randomUUID(), type: "Follow" });
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
            const acceptUri = buildObjecrUri({ url, uuid: crypto.randomUUID(), type: "Accept" });
            await db.insert(activities).values({
                uri: acceptUri,
                type: "Accept",
                actor: target.actorUrl,
                objectId: followAct.insertedId,
                objectType: "Follow",
            });
        } else {
            // 否：记录 Follow Activity，丢进队列异步投递
            await dispatchActivity(url, {
                type: "Follow",
                actor: user.actorUrl,
                objectUri: body.targetActorUrl,
                targets: [body.targetActorUrl],
            });
        }
    } catch (error: any) {
        console.log(error.message);
        return Response.json({
            error: "Server internal error.",
        }, {
            status: 500,
        });
    }

    return Response.json({}, {
        status: 200,
    })
}
