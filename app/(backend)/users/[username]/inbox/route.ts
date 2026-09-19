import { APActivity, APActor, APOrderedCollection } from "@/src/activitypub/ap";
import { getActor, getWebfinger, postInbox } from "@/src/activitypub/network";
import { buildActivity } from "@/src/activitypub/tools";
import { users } from "@/src/db/schema";
import { HeaderSource, verifyActivityPubRequest, verifyRfc9421 } from "@/src/utils/signature";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

type DBUser = typeof users.$inferSelect;

interface Params {
    username: string
}

export async function GET(request: Request) {
    // 返回占位符
    const data: APOrderedCollection = {
        id: "",
        summary: "",
        type: "OrderedCollection",
        totalItems: 0,
        orderedItems: [],
    };

    return Response.json(data, {
        status: 200
    });
}

// 远程服务器 POST 到 /users/[username]/inbox
export async function POST(request: Request, { params }: { params: Params }) {
    // 解析参数
    const url = new URL(request.url);
    const body = await request.json<APActivity>();

    // 获取 Actor
    const atRes = await getActor(body.actor);
    if (!atRes.ok) {
        return Response.json({
            error: "Actor not found.",
        }, {
            status: 400,
        });
    }
    const actor = await atRes.json<APActor>();

    // 验证签名
    const valid = await tryVerifySignature(
        request.method, 
        request.url,
        request.headers,
        actor.publicKey.publicKeyPem,
        actor.publicKey.id,
    );


    // 签名通过则接收
    if (valid) {
        return Response.json({
            error: "Signature is invalid.",
        }, {
            status: 401,
        });
    }

    // 根据类型进行处理
    const db = drizzle(env.DB);
    const result = await db.select().from(users).where(eq(users.username, params.username));
    if (result.length == 0) {
        return Response.json({
            error: "User not found."
        }, {
            status: 404,
        });
    }
    const user = result[0];
    const success = await handleActivity(url, user, actor, body);

    // TODO: 如果成功处理，看数据库是否有重复，如果没有则存入数据库
    if (success) {

    }
}

async function handleActivity(url: URL, user: DBUser, remoteActor: APActor, activity: APActivity) {
    const actType = activity.type;
    switch (actType) {
        case "Create":
            break;
        case "Follow": // 远程用户关注自动同意请求
            // 构建 Accept Activity
            const acceptAct = buildActivity(url, crypto.randomUUID(), "Accept", user.actorUrl, activity);

            // Post Activity
            const res = await postInbox(remoteActor.inbox, user.privateKey, `${user.actorUrl}#main-key`, acceptAct);

            if (res.ok) {
                return true;
            }

            break;
        case "Undo":
            break;
    }

    return false;
}

async function tryVerifySignature(
    method: string,
    url: string,
    headers: HeaderSource,
    publicKey: string,
    expectedKeyId: string,
) {
    // legacy
    const apValid = await verifyActivityPubRequest({
        method,
        url,
        headers,
        publicKey,
        expectedKeyId,
    });

    if (apValid) {
        return true;
    }

    // RFC 9421
    const rfcValid = await verifyRfc9421({
        method,
        url,
        headers,
        publicKey,
    })

    if (rfcValid) {
        return true;
    }

    return false;
}
