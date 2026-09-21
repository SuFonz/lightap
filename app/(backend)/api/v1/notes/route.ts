import { buildActivity, buildNote } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { activities, follows, notes, users } from "@/src/db/schema";
import { produce } from "@/src/queue";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type UserPayload = JwtPayload & {
    username: string,
}

interface Body {
    content: string,
    inReplyTo?: string,
}

export async function POST(request: Request) {
    // 解析参数
    const url = new URL(request.url);
    const body = await request.json<Body>();

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

    const payload = await decodeJwt<UserPayload>(token);
    const username = payload?.username;
    if (!username) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 403,
        });
    }

    try {
        // 存入数据库
        const db = getDBClient();
        const user = (await db.select().from(users).where(
            and(
                eq(users.username, username),
                eq(users.domain, url.host)
            )
        ))[0];

        // Note 与 Create Activity
        const note = buildNote(url, crypto.randomUUID(), body.content, body.inReplyTo);
        const dbNote = (await db.insert(notes).values({
            uri: note.id,
            actor: user.actorUrl,
            content: body.content,
            inReplyTo: body.inReplyTo ?? null,
        }).returning())[0];

        const create = buildActivity(url, crypto.randomUUID(), "Create", user.actorUrl, note);

        const dbAct = (await db.insert(activities).values({
            uri: create.id,
            type: "Create",
            actor: user.actorUrl,
            objectId: dbNote.id,
            objectType: "Note",
        }).returning({ insertedId: activities.id }))[0];

        // 递送：关注者 + 被回复者（本地实例的用户直接跳过，他们走本地数据库）
        const inboxes = new Set(
            (await db.select().from(follows).where(eq(follows.following, user.actorUrl))).map(f => f.follower)
        );
        if (body.inReplyTo) {
            const reply = (await db.select().from(notes).where(eq(notes.uri, body.inReplyTo)))[0];
            if (reply) {
                inboxes.add(reply.actor);
            }
        }

        // 远端收件人丢进队列异步投递
        await Promise.all(
            [...inboxes]
                .filter(actorUrl => !actorUrl.startsWith(`${url.origin}/users/`))
                .map(targetActor => produce({ targetActor, activityId: dbAct.insertedId }))
        );
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
