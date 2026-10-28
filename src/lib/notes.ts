import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { getDBClient } from "@/src/db";
import { likes, notes, users } from "@/src/db/schema";
import { deserializeAttachments } from "@/src/lib/attachments";

type NoteRow = typeof notes.$inferSelect;

/**
 * 列表项只用到这几个作者字段。`users` 表的 `private_key` 单列就占一行九成以上
 * （2048 位 RSA 私钥，约 1.6KB/行），时间线完全不需要，所以显式列出字段。
 */
const AUTHOR_COLUMNS = {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    actorUrl: users.actorUrl,
};

/**
 * 把 notes 行组装成前端列表项：补齐作者展示信息、直接回复数、点赞数，
 * 以及当前登录用户是否赞过（viewerId 为空时 liked 一律 false）。
 *
 * 作者信息来自 `users` 表（本地 + 已落库的远程用户），所以远程帖子要先 upsert 才能显示作者。
 * 作者、回复数、点赞数都批量查询，避免在循环里逐条查。
 *
 * 四条辅助查询互不依赖，用 `batch()` 合成一次往返：D1 每次查询都有固定开销，
 * 合并后省掉 2~3 次网络往返（文档也建议用 batch 摊薄 per-request 开销）。
 *
 * 返回项的字段由调用方（各 route 文件）声明的响应接口约定，这里不单独定义接口。
 */
export async function toNoteListItems(rows: NoteRow[], viewerId?: number) {
    if (rows.length === 0) {
        return [];
    }

    const db = getDBClient();
    const noteIds = rows.map(row => row.id);
    const actorUrls = rows.map(row => row.actor);
    const noteUris = rows.map(row => row.uri);

    // 批量取作者 / 统计回复数 / 统计点赞数 / 当前用户赞过哪些，一次往返
    const [authors, replyRows, likeRows, liked] = await db.batch([
        db.select(AUTHOR_COLUMNS).from(users).where(inArray(users.actorUrl, actorUrls)),
        db.select({ inReplyTo: notes.inReplyTo, value: count() })
            .from(notes)
            .where(and(
                inArray(notes.inReplyTo, noteUris),
                isNull(notes.deletedAt),
            ))
            .groupBy(notes.inReplyTo),
        db.select({ noteId: likes.noteId, value: count() })
            .from(likes)
            .where(inArray(likes.noteId, noteIds))
            .groupBy(likes.noteId),
        // 未登录时用一个恒空的条件代替第 4 条查询，保持 batch 形状稳定
        viewerId
            ? db.select({ noteId: likes.noteId }).from(likes).where(
                and(
                    inArray(likes.noteId, noteIds),
                    eq(likes.userId, viewerId),
                ),
            )
            : db.select({ noteId: likes.noteId }).from(likes).where(eq(likes.noteId, -1)),
    ]);

    const userByActor = new Map(authors.map(user => [user.actorUrl, user]));
    const countByUri = new Map(replyRows.map(row => [row.inReplyTo, row.value]));
    const likeCountByNote = new Map(likeRows.map(row => [row.noteId, row.value]));
    const likedNoteIds = new Set(liked.map(row => row.noteId));

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
            // 远程帖子的附件（图片/视频/音频/文件）；本站帖子恒为空数组
            attachment: deserializeAttachments(row.attachment),
            liked: likedNoteIds.has(row.id),
            likeCount: likeCountByNote.get(row.id) ?? 0,
            repliesCount: countByUri.get(row.uri) ?? 0,
            createdAt: row.createdAt,
        };
    });
}
