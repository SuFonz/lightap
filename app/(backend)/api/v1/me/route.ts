import { getDBClient } from "@/src/db";
import { users } from "@/src/db/schema";
import { resolveRequestUser } from "@/src/lib/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Body {
    displayName?: string;
    /** 简介（对应 users.summary） */
    bio?: string;
}

const MAX_DISPLAY_NAME = 20;
const MAX_BIO = 160;

/**
 * 更新当前登录用户的资料：PATCH /api/v1/me
 *
 * 只更新请求体里出现的字段（部分更新）。Actor 端点是用这张表拼的，
 * 所以改完远程抓取 `/users/[username]` 也会跟着变。
 */
export async function PATCH(request: Request) {
    const user = await resolveRequestUser(request);
    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 401,
        });
    }

    const body = await request.json<Body>().catch(() => ({} as Body));
    const patch: Partial<typeof users.$inferInsert> = {};

    // 昵称：给了就必须非空
    if (body.displayName !== undefined) {
        if (typeof body.displayName !== "string") {
            return Response.json({ error: "Invalid display name." }, { status: 400 });
        }
        const displayName = body.displayName.trim();
        if (!displayName) {
            return Response.json({ error: "Display name cannot be empty." }, { status: 400 });
        }
        if (displayName.length > MAX_DISPLAY_NAME) {
            return Response.json({ error: `Display name must be at most ${MAX_DISPLAY_NAME} characters.` }, { status: 400 });
        }
        patch.displayName = displayName;
    }

    // 简介：空字符串表示清空（存 null）
    if (body.bio !== undefined) {
        if (typeof body.bio !== "string") {
            return Response.json({ error: "Invalid bio." }, { status: 400 });
        }
        const bio = body.bio.trim();
        if (bio.length > MAX_BIO) {
            return Response.json({ error: `Bio must be at most ${MAX_BIO} characters.` }, { status: 400 });
        }
        patch.summary = bio || null;
    }

    if (Object.keys(patch).length === 0) {
        return Response.json({ error: "No fields to update." }, { status: 400 });
    }

    const db = getDBClient();
    await db.update(users).set({
        ...patch,
        updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(users.id, user.id));

    return Response.json({
        displayName: patch.displayName ?? user.displayName ?? "",
        bio: patch.summary !== undefined ? (patch.summary ?? "") : (user.summary ?? ""),
    }, {
        status: 200,
    });
}
