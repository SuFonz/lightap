import { APActor } from "@/src/activitypub/ap";
import { getActor, postInbox } from "@/src/activitypub/network";
import { buildActivity, buildActivityWithUri } from "@/src/activitypub/tools";
import { activities, follows, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

type UserPayload = JwtPayload & {
    username: string,
}

interface Body {
    username: string,
    domain: string,
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
    const db = drizzle(env.DB);
    const body = await request.json<Body>();
    if (body.domain == url.host) {
        try {
            
            // 是：获取当前用户
            const user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];
    
            // 查询另一位用户
            const target = (await db.select().from(users).where(eq(users.username, body.username)))[0];
    
            // Follows 从数据库中删除
            await db.delete(follows).where(
                and(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, target.actorUrl),
                ),
            ).returning();

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
            // 否：获取远程 Actor
            const atRes = await getActor(body.domain);
            if (!atRes.ok) {
                return Response.json({
                    error: "Remote user not found.",
                }, {
                    status: 404,
                });
            }
            const actor = await atRes.json<APActor>();

            // 获取当前用户私钥
            const user = (await db.select().from(users).where(eq(users.username, payload.username)))[0]

            // 获取 Follow Activity
            const dbFollow = (await db.select().from(follows).where(
                and(
                    eq(follows.follower, user.actorUrl),
                    eq(follows.following, actor.id),
                )
            ))[0];
            const dbActivity = (await db.select().from(activities).where(
                and(
                    eq(activities.objectId, dbFollow.id),
                    eq(activities.type, "Follow"),
                )
            ))[0];

            // 给远程用户发送 Unfollow Activity
            const follow = buildActivityWithUri(dbActivity.uri, "Follow", dbFollow.follower, dbFollow.following);
            const undo = buildActivity(url, crypto.randomUUID(), "Undo", user.actorUrl, follow);
            const faRes = await postInbox(actor.inbox, user.privateKey, `${user.actorUrl}#main-key`, undo);
            if (!faRes.ok) {
                return Response.json({
                    error: "Follow failed."
                }, {
                    status: 401,
                });
            }

            // Follows 从数据库中删除
            await db.delete(follows).where(
                and(
                    eq(follows.follower, dbFollow.follower),
                    eq(follows.following, dbFollow.following),
                )
            ).returning({ deletedId: follows.id });

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
