import { getDBClient } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { resolveRequestUser } from "@/src/lib/auth";
import { and, eq, inArray, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Body {
    /** 要标记为已读的通知 id 数组 */
    ids: number[],
}

/** 把指定通知标记为已读：POST /api/v1/notifications/read */
export async function POST(request: Request) {
    const db = getDBClient();

    const user = await resolveRequestUser(request);
    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 401,
        });
    }

    const body = await request.json<Body>();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
        return Response.json({}, {
            status: 200,
        });
    }

    // 只标记「属于当前用户」且「未读」的那些
    await db.update(notifications).set({
        readAt: Math.floor(Date.now() / 1000),
    }).where(
        and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
            inArray(notifications.id, ids),
        ),
    );

    return Response.json({}, {
        status: 200,
    });
}
