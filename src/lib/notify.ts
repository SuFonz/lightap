import { eq } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { notes, notifications, users } from "@/src/db/schema";
import type { NotificationType } from "@/src/lib/notifications";
import { publishEvent } from "@/src/realtime/sse";

interface CreateNotificationInput {
    /** 收件人（本站用户 id） */
    userId: number,
    /** 触发者（用户 id） */
    actorId: number,
    type: NotificationType,
    noteId?: number,
}

/**
 * 写一条通知，并把 `notification.created` 实时推给收件人。
 *
 * 通知是私有的，只推给指定的登录用户（`{ type: "user" }`），不会广播给所有人。
 * 实时推送失败不影响通知落库。
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
    // 自己触发自己的忽略
    if (input.userId === input.actorId) return;

    const db = getDBClient();
    const inserted = (await db.insert(notifications).values({
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        noteId: input.noteId ?? null,
    }).returning())[0];

    // 组装实时推送的 payload（与 GET /api/v1/notifications 的 item 一致）
    const actor = (await db.select().from(users).where(eq(users.id, input.actorId)))[0];
    const note = input.noteId != null
        ? (await db.select().from(notes).where(eq(notes.id, input.noteId)))[0]
        : undefined;

    try {
        await publishEvent({
            type: "notification.created",
            data: {
                id: inserted.id,
                type: inserted.type,
                read: false,
                createdAt: inserted.createdAt,
                user: {
                    id: actor?.id ?? input.actorId,
                    username: actor?.username ?? "",
                    domain: actor?.domain ?? "",
                    displayName: actor?.displayName ?? "",
                    avatarUrl: actor?.avatarUrl ?? "",
                },
                note: note ? { uuid: note.uuid, content: note.content } : null,
            },
        }, { type: "user", userId: input.userId });
    } catch {
        // 实时推送失败不影响通知本身
    }
}
