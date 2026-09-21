import { buildActivity, buildObjecrUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities, follows, users } from "@/src/db/schema";
import { produce } from "@/src/queue";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type UserPayload = JwtPayload & {
    username: string,
}

interface Body {
    username: string,
    domain: string,
    targetActorUrl: string,
}

export async function POST(request: Request) {
    // 解析参数
    const url = new URL(request.url);

    // 验证 JWT
    const auth = request.headers.get("Authorization");
    if (!auth) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    const [type, token] = auth.split(" ");
    if (type !== "Bearer" || !token) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    const valid = await verifyJwt(token, env.JWT_SECRET);
    if (!valid) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    // 获取 User
    const payload = await decodeJwt<UserPayload>(token);
    const username = payload?.username;
    if (!username) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    // 是否本地用户
    const db = getDBClient();
    const body = await request.json<Body>();
    if (body.domain == url.host) {
        // 是：获取当前用户
        try {
            const user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];

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
            const user = (await db.select().from(users).where(eq(users.username, payload.username)))[0]

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
