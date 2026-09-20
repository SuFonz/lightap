import { APOrderedCollection } from "@/src/activitypub/ap";
import { buildActor } from "@/src/activitypub/tools";
import { users } from "@/src/db/schema";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

interface Params {
    username: string
}

export async function GET(
    request: Request,
    { params }: { params: Params }
) {
    // 解析参数
    const url = new URL(request.url);
    const username = params.username;

    // 获取用户
    const db = drizzle(env.DB);
    const user = (await db.select().from(users).where(eq(users.username, username)))[0];
    if (!user) {
        return Response.json({ 
            error: "User not found.",
        }, { 
            status: 404,
        });
    }

    // 构建 Actor
    const actor = buildActor(
        url,
        user.displayName ,
        user.username,
        user.summary,
        user.publicKey,
    );

    // 返回 Actor
    return Response.json(actor, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        }
    });
}
