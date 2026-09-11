import { env } from "cloudflare:workers";
import { getPublicFeed } from "@/lib/db/objects";
import { getTimelineForUser } from "@/lib/db/timeline";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { htmlToPlainText } from "@/lib/activitypub/tools";
import { verify } from "@/lib/util/jwt";
import { HttpError, Post, PostResult, UserJwtPayload } from "@/lib/types/http";
import { UserRow } from "@/lib/types/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseNumber(value: string | null, fallback: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(Math.floor(n), max);
}

function toPost(
    note: { url: string; content: string; created_at: Date },
    authorUsername: string,
): Post {
    return {
        id: note.url,
        authorUsername,
        content: htmlToPlainText(note.content),
        createdAt: note.created_at.toISOString(),
        likes: 0,
        likedByMe: false,
        boosts: 0,
        boostedByMe: false,
        replies: [],
    };
}

async function getAuthenticatedUser(request: Request): Promise<UserRow | null> {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    try {
        const payload = await verify<UserJwtPayload>(token, env.JWT_SECRET);
        return await getUserByPreferredUsername(payload.username);
    } catch {
        return null;
    }
}

/**
 * 时间线：
 * - type=public  公共时间线（无需登录）
 * - type=following    关注时间线（需要 Authorization: Bearer <jwt>）
 *
 * 个人资料时间线在 /api/v1/users/:username/posts
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "public";
    const limit = parseNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parseNumber(url.searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

    console.log(request.url);

    try {
        if (type === "following") {
            const user = await getAuthenticatedUser(request);
            if (!user) {
                return Response.json({ error: "未登录" } satisfies HttpError, { status: 401 });
            }

            const notes = await getTimelineForUser(user.id, limit, offset);
            return Response.json({
                posts: notes.map((note) => toPost(note, note.author_username)),
            } satisfies PostResult);
        }

        const notes = await getPublicFeed(limit, offset);
        console.log("Public feed notes:", notes);
        return Response.json({
            posts: notes.map((note) => toPost(note, note.author_username)),
        } satisfies PostResult);
    } catch (e) {
        console.error("get feed failed:", e);
        return Response.json(
            { error: "获取时间线失败，请稍后重试" } satisfies HttpError,
            { status: 500 }
        );
    }
}
