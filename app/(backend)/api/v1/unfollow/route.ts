import { buildActivity, buildObjecrUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities, follows, users } from "@/src/db/schema";
import { produce } from "@/src/queue";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, desc, eq, inArray } from "drizzle-orm";

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
        try {
            // 是：一次查询取出当前用户和另一位用户
            const found = await db.select().from(users).where(
                inArray(users.username, [payload.username, body.username]),
            );
            const user = found.find(item => item.username === payload.username);
            const target = found.find(item => item.username === body.username);
            if (!user || !target) {
                return Response.json({
                    error: "User not found.",
                }, {
                    status: 404,
                });
            }

            // Follows 从数据库中删除（没关注过则直接返回，保证重复取关幂等）
            const deleted = await db.delete(follows).where(
                and(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, target.actorUrl),
                ),
            ).returning();
            if (deleted.length === 0) {
                return Response.json({}, {
                    status: 200,
                });
            }

            // 获取最新的 Follow Activity
            const dbActivity = (await db.select().from(activities).where(
                and(
                    eq(activities.type, "Follow"),
                    eq(activities.actor, user.actorUrl),
                    eq(activities.objectUri, target.actorUrl),
                )
            ).orderBy(desc(activities.id)))[0];
            if (!dbActivity) {
                return Response.json({}, {
                    status: 200,
                });
            }

            // Undo Follow Activity 存到数据库
            const undoUri = buildObjecrUri(url, crypto.randomUUID(), "Undo");
            await db.insert(activities).values({
                uri: undoUri,
                type: "Undo",
                actor: user.actorUrl,
                objectId: dbActivity.id,
                objectType: "Follow",
            });

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

            // Follows 从数据库中删除（没关注过则直接返回，保证重复取关幂等）
            const deleted = await db.delete(follows).where(
                and(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, body.targetActorUrl),
                )
            ).returning();
            if (deleted.length === 0) {
                return Response.json({}, {
                    status: 200,
                });
            }

            // 获取最新的 Follow Activity（object 是目标 Actor 的链接）
            const dbActivity = (await db.select().from(activities).where(
                and(
                    eq(activities.type, "Follow"),
                    eq(activities.actor, user.actorUrl),
                    eq(activities.objectUri, body.targetActorUrl),
                )
            ).orderBy(desc(activities.id)))[0];
            if (!dbActivity) {
                return Response.json({}, {
                    status: 200,
                });
            }

            // 构建 Undo Follow Activity 并存入数据库
            const undo = buildActivity(url, crypto.randomUUID(), "Undo", user.actorUrl, dbActivity.uri);
            const dbAct = (await db.insert(activities).values({
                uri: undo.id,
                type: "Undo",
                actor: user.actorUrl,
                objectUri: dbActivity.uri,
                objectId: dbActivity.id,
                objectType: "Follow",
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
