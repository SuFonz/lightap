import { count, inArray } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { notes, users } from "@/src/db/schema";

type NoteRow = typeof notes.$inferSelect;

/**
 * 把 notes 行组装成前端列表项：补齐作者展示信息和直接回复数。
 *
 * 作者信息来自 `users` 表（本地 + 已落库的远程用户），所以远程帖子要先 upsert 才能显示作者。
 * 一次批量查作者、一次批量统计回复数，避免在循环里逐条查询。
 *
 * 返回项的字段由调用方（各 route 文件）声明的响应接口约定，这里不单独定义接口。
 */
export async function toNoteListItems(rows: NoteRow[]) {
    if (rows.length === 0) {
        return [];
    }

    const db = getDBClient();

    // 批量取作者，避免 N+1
    const authors = await db.select().from(users).where(
        inArray(users.actorUrl, rows.map(row => row.actor)),
    );
    const userByActor = new Map(authors.map(user => [user.actorUrl, user]));

    // 批量统计每条的回复数
    const replyRows = await db.select({ inReplyTo: notes.inReplyTo, value: count() })
        .from(notes)
        .where(inArray(notes.inReplyTo, rows.map(row => row.uri)))
        .groupBy(notes.inReplyTo);
    const countByUri = new Map(replyRows.map(row => [row.inReplyTo, row.value]));

    return rows.map(row => {
        const author = userByActor.get(row.actor);
        return {
            id: row.id,
            uuid: row.uuid,
            uri: row.uri,
            username: author?.username ?? "",
            displayName: author?.displayName ?? "",
            avatarUrl: author?.avatarUrl ?? "",
            domain: new URL(row.actor).host,
            content: row.content,
            inReplyTo: row.inReplyTo,
            repliesCount: countByUri.get(row.uri) ?? 0,
            createdAt: row.createdAt,
        };
    });
}
