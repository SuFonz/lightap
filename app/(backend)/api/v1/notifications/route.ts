import { getDBClient } from "@/src/db";
import { notes, notifications, users } from "@/src/db/schema";
import { resolveRequestUser } from "@/src/lib/auth";
import { NotificationType } from "@/src/lib/notifications";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 25;

interface Notification {
    id: number,
    type: NotificationType,
    read: boolean,
    /** 秒（与 feed/notes 接口一致） */
    createdAt: number,
    /** 触发通知的用户 */
    user: {
        id: number,
        username: string,
        domain: string,
        displayName: string,
        avatarUrl: string,
    },
    /** 相关帖子（Follow 没有 note，为 null） */
    note: {
        uuid: string,
        content: string,
    } | null,
}

interface Body {
    limit?: number,
    maxId?: number,
}

/** 通知列表：GET /api/v1/notifications?limit=&maxId= */
export async function GET(request: Request) {
    // 解析参数
    const url = new URL(request.url);
    const body: Body = {
        limit: Math.min(Number(url.searchParams.get("limit")) || MAX_LIMIT, MAX_LIMIT),
        maxId: Number(url.searchParams.get("maxId")) || undefined,
    };

    const db = getDBClient();

    // 当前登录用户（通知是私有的，必须登录）
    const viewer = await resolveRequestUser(request);
    if (!viewer) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 401,
        });
    }

    // 查当前用户的通知，按 id 倒序分页
    const rows = await db.select().from(notifications).where(
        and(
            eq(notifications.userId, viewer.id),
            body.maxId ? lt(notifications.id, body.maxId) : undefined,
        ),
    ).orderBy(desc(notifications.id)).limit(body.limit ?? MAX_LIMIT);

    // 触发者与相关 note 互不依赖，合成一次往返；都只取展示需要的列
    const actorIds = [...new Set(rows.map(row => row.actorId))];
    const noteIds = [...new Set(
        rows.map(row => row.noteId).filter((id): id is number => id != null),
    )];

    const [actors, noteRows] = await db.batch([
        // private_key / password_hash 等大字段不取
        actorIds.length > 0
            ? db.select({
                id: users.id,
                username: users.username,
                domain: users.domain,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
            }).from(users).where(inArray(users.id, actorIds))
            : db.select({
                id: users.id,
                username: users.username,
                domain: users.domain,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
            }).from(users).where(eq(users.id, -1)),
        // 通知卡片只需要 uuid + 正文
        noteIds.length > 0
            ? db.select({ id: notes.id, uuid: notes.uuid, content: notes.content })
                .from(notes).where(inArray(notes.id, noteIds))
            : db.select({ id: notes.id, uuid: notes.uuid, content: notes.content })
                .from(notes).where(eq(notes.id, -1)),
    ]);

    const userById = new Map(actors.map(actor => [actor.id, actor]));
    const noteById = new Map(noteRows.map(note => [note.id, note]));

    // 组装返回
    const items: Notification[] = rows.map(row => {
        const actor = userById.get(row.actorId);
        const note = row.noteId != null ? noteById.get(row.noteId) : undefined;
        return {
            id: row.id,
            type: row.type,
            read: row.readAt != null,
            createdAt: row.createdAt,
            user: {
                id: actor?.id ?? row.actorId,
                username: actor?.username ?? "",
                domain: actor?.domain ?? "",
                displayName: actor?.displayName ?? "",
                avatarUrl: actor?.avatarUrl ?? "",
            },
            note: note ? { uuid: note.uuid, content: note.content } : null,
        };
    });

    return Response.json({
        items,
    }, {
        status: 200,
    });
}
