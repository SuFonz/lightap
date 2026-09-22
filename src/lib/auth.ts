import { eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { users } from "@/src/db/schema";

export type DBUser = typeof users.$inferSelect;

/**
 * 取当前登录用户。
 *
 * 身份由 proxy 中间件校验后写进 `x-user-id` 请求头，这里只负责按 id 查库。
 * 未登录、或 id 对应的用户不存在时返回 undefined（公开接口允许游客访问）。
 */
export async function resolveRequestUser(request: Request): Promise<DBUser | undefined> {
    const userId = Number(request.headers.get("x-user-id"));
    if (!userId) {
        return undefined;
    }

    return (await getDBClient().select().from(users).where(eq(users.id, userId)))[0];
}
