import { eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { users } from "@/src/db/schema";

export type DBUser = typeof users.$inferSelect;

/**
 * 取当前登录用户。
 *
 * 身份由 proxy 中间件校验后写进 `x-user-id` 请求头，这里只负责按 id 查库。
 * 未登录、或 id 对应的用户不存在时返回 undefined（公开接口允许游客访问）。
 *
 * 返回整行（含 `privateKey`）：这个函数每个请求都会走，但真正需要私钥的
 * 只有「远程搜索 / inbox 验签」这类极少数的联邦请求，其余接口只用到
 * id / username / actorUrl / domain。这里不裁剪字段，是为了让需要私钥的调用方
 * 不必再多查一次；`users` 表本身不大，按主键取单行的成本可以忽略。
 */
export async function resolveRequestUser(request: Request): Promise<DBUser | undefined> {
    const userId = Number(request.headers.get("x-user-id"));
    if (!userId) {
        return undefined;
    }

    return (await getDBClient().select().from(users).where(eq(users.id, userId)))[0];
}
