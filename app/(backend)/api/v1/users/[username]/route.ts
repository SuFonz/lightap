import { follows, notes, users } from "@/src/db/schema";
import { and, count, eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";

export const dynamic = "force-dynamic";

type DBUser = typeof users.$inferSelect;

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

    // 只查本地数据库
    const db = getDBClient();
    const user = (await db.select().from(users).where(eq(users.username, username)))[0];
    if (!user) {
        return Response.json({
            error: "User not found.",
        }, {
            status: 404,
        });
    }

    // 当前登录用户（可选），用于判断是否已关注；身份由中间件校验，取 x-user-id
    let viewer: DBUser | null = null;
    const viewerId = Number(request.headers.get("x-user-id"));
    if (viewerId) {
        viewer = (await db.select().from(users).where(eq(users.id, viewerId)))[0];
    }

    // 统计帖子数、关注数、粉丝数
    const postsCount = (await db.select({ value: count() }).from(notes).where(eq(notes.actor, user.actorUrl)))[0].value;
    const followingCount = (await db.select({ value: count() }).from(follows).where(eq(follows.follower, user.actorUrl)))[0].value;
    const followersCount = (await db.select({ value: count() }).from(follows).where(eq(follows.following, user.actorUrl)))[0].value;

    // 当前登录用户是否关注了 TA
    let isFollowing = false;
    if (viewer) {
        const followed = (await db.select().from(follows).where(
            and(
                eq(follows.follower, viewer.actorUrl),
                eq(follows.following, user.actorUrl),
            ),
        ))[0];
        isFollowing = !!followed;
    }

    // 返回
    const data: Profile = {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? "",
        bio: user.summary ?? "",
        actorUrl: user.actorUrl,
        domain: null,
        instance: url.host,
        postsCount: postsCount,
        followingCount: followingCount,
        followersCount: followersCount,
        isFollowing: isFollowing,
        createdAt: user.createdAt,
    };

    return Response.json(data, {
        status: 200,
    });
}
