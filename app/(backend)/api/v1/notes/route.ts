import { AP_CONTEXT, APActor, APNote } from "@/src/activitypub/ap";
import { getActor, postInbox } from "@/src/activitypub/network";
import { buildActivity, buildNote, convertActorUrlToMainKey, parseSearch } from "@/src/activitypub/tools";
import { activities, follows, notes, users } from "@/src/db/schema";
import { decodeJwt, JwtPayload, verifyJwt } from "@/src/utils/jwt";
import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

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
        const db = drizzle(env.DB);
        const user = (await db.select().from(users).where(eq(users.username, username)))[0];

        // Note 与 Create Activity
        const note = buildNote(url, crypto.randomUUID(), body.content, body.inReplyTo);
        const dbNote = (await db.insert(notes).values({
            uri: note.id,
            actor: user.actorUrl,
            content: body.content,
            inReplyTo: body.inReplyTo ?? null,
        }).returning())[0];

        const create = buildActivity(url, crypto.randomUUID(), "Create", user.actorUrl, note);

        await db.insert(activities).values({
            uri: create.id,
            type: "Create",
            actor: user.actorUrl,
            objectId: dbNote.id,
        });

        // 递送：关注者 + 被回复者
        const inboxes = new Set(
            (await db.select().from(follows).where(eq(follows.following, user.actorUrl))).map(f => f.follower)
        );
        if (body.inReplyTo) {
            const reply = (await db.select().from(notes).where(eq(notes.uri, body.inReplyTo)))[0];
            if (reply) {
                inboxes.add(reply.actor);
            }
        }

        await Promise.all([...inboxes].map(async (actorUrl) => {
            const userMkUrl = convertActorUrlToMainKey(user.actorUrl);
            const atRes = await getActor(actorUrl, user.privateKey, userMkUrl);
            if (!atRes.ok) {
                return;
            }
            const actor = await atRes.json<APActor>();
            
            await postInbox(actor.inbox, user.privateKey, userMkUrl, create);
        }));
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
