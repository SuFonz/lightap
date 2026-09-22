import type { APActor } from "@/src/activitypub/ap";
import { getDBClient } from "@/src/db";
import { users } from "@/src/db/schema";

/**
 * 把远程 Actor 落库（已存在则更新展示信息）。
 *
 * feed 的作者信息是从 `users` 表 join 出来的，所以远程用户必须先存进来，
 * 时间线才能拿到 username / displayName / avatarUrl。
 *
 * 远程用户不能登录：`passwordHash` / `privateKey` 留空，
 * 且登录接口按本站 origin 过滤 actorUrl，远程用户登不进来。
 * 按 `actorUrl`（唯一键）做 upsert，重复投递不会炸唯一约束。
 */
export async function upsertRemoteUser(actor: APActor): Promise<void> {
    const db = getDBClient();
    const domain = new URL(actor.id).host;
    const displayName = actor.name || actor.preferredUsername;
    const avatarUrl = actor.icon?.url ?? null;

    await db.insert(users).values({
        username: actor.preferredUsername,
        domain,
        displayName,
        avatarUrl,
        actorUrl: actor.id,
        publicKey: actor.publicKey.publicKeyPem,
        privateKey: "",
        passwordHash: "",
    }).onConflictDoUpdate({
        target: users.actorUrl,
        set: {
            username: actor.preferredUsername,
            displayName,
            avatarUrl,
            publicKey: actor.publicKey.publicKeyPem,
        },
    });
}
