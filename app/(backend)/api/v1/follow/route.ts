import { APActor } from "@/src/activitypub/ap";
import { getActor, postInbox } from "@/src/activitypub/network";
import { buildActivity, buildObjecrUri } from "@/src/activitypub/tools";
import { activities, follows, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

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
    const db = drizzle(env.DB);
    const body = await request.json<Body>();
    if (body.domain == url.host) {
        // 是：获取当前用户
        try {
            const user = (await db.select().from(users).where(eq(users.username, payload.username)))[0];

            // 查询另一位用户
            const target = (await db.select().from(users).where(eq(users.username, body.username)))[0];

            // Follows 和 Activity 存入数据库
            const follow = (await db.insert(follows).values({
                follower: user.actorUrl,
                following: target.actorUrl,
            }).returning({ insertedId: users.id }))[0];

            // Activity
            const uri = buildObjecrUri(url, crypto.randomUUID(), "Follow");
            const activity = (await db.insert(activities).values({
                uri: uri,
                type: "Follow",
                actor: user.actorUrl,
                objectId: follow.insertedId,
            }).returning())[0];

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

            // 构建 Follow Activity
            const followAct = buildActivity(url, crypto.randomUUID(), "Follow", user.actorUrl, body.targetActorUrl);

            // 给远程用户发送 Follow Activity
            const faRes = await postInbox(actor.inbox, user.privateKey, `${user.actorUrl}#main-key`, followAct);
            if (!faRes.ok) {
                return Response.json({
                    error: "Follow failed."
                }, {
                    status: 401,
                });
            }

            // Follows 和 Activity 存入数据库
            const follow = (await db.insert(follows).values({
                follower: user.actorUrl,
                following: body.targetActorUrl,
            }).returning({ insertedId: follows.id }))[0];

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
