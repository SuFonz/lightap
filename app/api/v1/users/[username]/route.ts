import { env } from "cloudflare:workers";
import { getUserByPreferredUsername, updateUserProfile } from "@/lib/db/users";
import { countFollowersOf, countFollowingOf } from "@/lib/db/follows";
import { countNotesByPreferredUsername } from "@/lib/db/objects";
import { verify } from "@/lib/util/jwt";
import type { UserJwtPayload } from "@/lib/types/http";

export const dynamic = "force-dynamic";

function safeHost(id: string): string | null {
    try {
        return new URL(id).host;
    } catch {
        return null;
    }
}

async function getAuthenticatedUsername(
    request: Request
): Promise<string | null> {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
        return null;
    }

    try {
        const payload = await verify<UserJwtPayload>(token, env.JWT_SECRET);
        return payload.username;
    } catch {
        return null;
    }
}

export async function GET(
    request: Request,
    { params }: { params: { username: string } }
) {
    const url = new URL(request.url);
    const username = params.username;

    if (!username) {
        return Response.json({ error: "用户名为空" }, { status: 400 });
    }

    try {
        const user = await getUserByPreferredUsername(username);
        if (!user) {
            return Response.json({ error: "用户不存在" }, { status: 404 });
        }

        const [followers, followingCount, postsCount] = await Promise.all([
            countFollowersOf(user.preferred_username),
            countFollowingOf(user.preferred_username),
            countNotesByPreferredUsername(user.preferred_username),
        ]);

        // 远端用户（搜索解析时落库）的 id 是其原实例的 Actor URL
        const localId = `${url.origin}/users/${user.preferred_username}`;
        const instance = user.id === localId ? null : safeHost(user.id);

        return Response.json({
            username: user.preferred_username,
            displayName: user.name,
            bio: user.summary ?? "",
            avatarUrl: user.icon_url ?? null,
            instance,
            // 本站用户的 id 即 Actor URL；远端落库用户是其原实例的 Actor URL
            actorUrl: user.id,
            followers,
            followingCount,
            postsCount,
            createdAt: user.created_at.toISOString(),
        });
    } catch (e) {
        console.error("get user profile failed:", e);
        return Response.json(
            { error: "获取资料失败，请稍后重试" },
            { status: 500 }
        );
    }
}

interface ProfilePatchBody {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
}

export async function PATCH(
    request: Request,
    { params }: { params: { username: string } }
) {
    const username = params.username;

    if (!username) {
        return Response.json({ error: "用户名为空" }, { status: 400 });
    }

    const authUsername = await getAuthenticatedUsername(request);
    if (!authUsername) {
        return Response.json({ error: "未登录" }, { status: 401 });
    }
    if (authUsername !== username) {
        return Response.json({ error: "只能修改自己的资料" }, { status: 403 });
    }

    let body: ProfilePatchBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "请求格式错误" }, { status: 400 });
    }

    const displayName = body.displayName?.trim();
    const bio = body.bio?.trim();
    const avatarUrl = body.avatarUrl?.trim();

    if (displayName !== undefined && (!displayName || displayName.length > 20)) {
        return Response.json(
            { error: "昵称需为 1-20 个字符" },
            { status: 400 }
        );
    }
    if (bio !== undefined && bio.length > 160) {
        return Response.json(
            { error: "简介最长 160 个字符" },
            { status: 400 }
        );
    }
    if (avatarUrl !== undefined && avatarUrl.length > 2048) {
        return Response.json({ error: "头像链接过长" }, { status: 400 });
    }

    try {
        const user = await getUserByPreferredUsername(username);
        if (!user) {
            return Response.json({ error: "用户不存在" }, { status: 404 });
        }

        await updateUserProfile(user.preferred_username, {
            ...(displayName !== undefined ? { name: displayName } : {}),
            ...(bio !== undefined ? { summary: bio } : {}),
            ...(avatarUrl !== undefined ? { icon_url: avatarUrl } : {}),
        });

        return Response.json({ ok: true });
    } catch (e) {
        console.error("update user profile failed:", e);
        return Response.json(
            { error: "保存失败，请稍后重试" },
            { status: 500 }
        );
    }
}
