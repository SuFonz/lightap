import { follows, notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { resolveRequestUser } from "@/src/lib/auth";
import { and, count, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
    username: string,
}

interface Profile {
    username: string,
    displayName: string,
    avatarUrl: string,
    bio: string,
    actorUrl: string,
    domain: string | null,
    instance: string,
    postsCount: number,
    followingCount: number,
    followersCount: number,
    isFollowing: boolean,
    createdAt: number,
}

export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 解析参数
    const url = new URL(request.url);
    const username = params.username;

    // domain 省略时按本站查；带上 domain 可查远程用户（区分同名）
    const domain = url.searchParams.get("domain") ?? url.host;
    const db = getDBClient();
    const user = (await db.select().from(users).where(
        and(
            eq(users.username, username),
            eq(users.domain, domain),
        ),
    ))[0];
    if (!user) {
        return Response.json({
            error: "User not found.",
        }, {
            status: 404,
        });
    }

    // 当前登录用户（可选），用于判断是否已关注
    const viewer = await resolveRequestUser(request);

    // 统计帖子数、关注数、粉丝数，以及当前登录用户是否已关注
    // 四条查询互不依赖，合并成一次往返（原来要 3~4 次）
    const [postsCount, followingCount, followersCount, followed] = await db.batch([
        db.select({ value: count() }).from(notes).where(eq(notes.actor, user.actorUrl)),
        db.select({ value: count() }).from(follows).where(eq(follows.follower, user.actorUrl)),
        db.select({ value: count() }).from(follows).where(eq(follows.following, user.actorUrl)),
        // 未登录时用恒空条件占位，保持 batch 形状稳定
        viewer
            ? db.select({ id: follows.id }).from(follows).where(
                and(
                    eq(follows.follower, viewer.actorUrl),
                    eq(follows.following, user.actorUrl),
                ),
            )
            : db.select({ id: follows.id }).from(follows).where(eq(follows.id, -1)),
    ]);

    // 返回
    const data: Profile = {
        username: user.username,
        displayName: user.displayName ?? "",
        avatarUrl: user.avatarUrl ?? "",
        bio: user.summary ?? "",
        actorUrl: user.actorUrl,
        domain: user.domain === url.host ? null : user.domain,
        instance: user.domain,
        postsCount: postsCount[0].value,
        followingCount: followingCount[0].value,
        followersCount: followersCount[0].value,
        isFollowing: followed.length > 0,
        createdAt: user.createdAt,
    };

    return Response.json(data, {
        status: 200,
    });
}
