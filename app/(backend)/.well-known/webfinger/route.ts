import { buildWebfinger, parseResource } from "@/src/activitypub/tools";
import { users } from "@/src/db/schema";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // 获取 resource
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    if (!resource) {
        return Response.json({
            error: "Missing resource."
        }, {
            status: 400,
        });
    }

    // 解析 acct:username@example.com
    const [username, domain] = parseResource(resource);

    // 检查用户是否存在
    const db = drizzle(env.DB);
    const result = await db.select().from(users).where(eq(users.username, username));
    if (result.length == 0) {
        return Response.json({
            error: "User not found."
        }, {
            status: 404,
        });
    }

    // 返回 webfinger
    const webfinger = buildWebfinger(url, username);
    return Response.json(webfinger, {
        status: 200,
        headers: {
            "Content-Type": "application/jrd+json",
        }
    });
}
