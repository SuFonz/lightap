import { and, count, eq, inArray } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { likes, notes, users } from "@/src/db/schema";

type NoteRow = typeof notes.$inferSelect;

/**
 * 把 notes 行组装成前端列表项：补齐作者展示信息、直接回复数、点赞数，
 * 以及当前登录用户是否赞过（viewerId 为空时 liked 一律 false）。
 *
 * 作者信息来自 `users` 表（本地 + 已落库的远程用户），所以远程帖子要先 upsert 才能显示作者。
 * 作者、回复数、点赞数都批量查询，避免在循环里逐条查。
 *
 * 返回项的字段由调用方（各 route 文件）声明的响应接口约定，这里不单独定义接口。
 */
export async function toNoteListItems(rows: NoteRow[], viewerId?: number) {
    if (rows.length === 0) {
        return [];
    }

    const db = getDBClient();
    const noteIds = rows.map(row => row.id);

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

    // 批量统计每条的点赞数
    const likeRows = await db.select({ noteId: likes.noteId, value: count() })
        .from(likes)
        .where(inArray(likes.noteId, noteIds))
        .groupBy(likes.noteId);
    const likeCountByNote = new Map(likeRows.map(row => [row.noteId, row.value]));

    // 当前登录用户赞过其中哪些
    let likedNoteIds = new Set<number>();
    if (viewerId) {
        const liked = await db.select({ noteId: likes.noteId }).from(likes).where(
            and(
                inArray(likes.noteId, noteIds),
                eq(likes.userId, viewerId),
            ),
        );
        likedNoteIds = new Set(liked.map(row => row.noteId));
    }

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
            liked: likedNoteIds.has(row.id),
            likeCount: likeCountByNote.get(row.id) ?? 0,
            repliesCount: countByUri.get(row.uri) ?? 0,
            createdAt: row.createdAt,
        };
    });
}
