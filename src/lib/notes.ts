import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { APNote } from "@/src/activitypub/ap";
import { getActor, getApObject } from "@/src/activitypub/network";
import { getDBClient } from "@/src/db";
import { announces, likes, notes, users } from "@/src/db/schema";
import { storeRemoteActor } from "@/src/lib/actor";
import { deserializeAttachments, parseAttachments, serializeAttachments } from "@/src/lib/attachments";

type NoteRow = typeof notes.$inferSelect;

/** 时间线里「这条帖子是谁转发的」 */
export interface AnnouncedBy {
    /** 转发者展示名 */
    username: string;
    displayName: string;
    avatarUrl: string;
    /** 转发者所在实例 */
    domain: string;
    /** Announce 活动的 uri */
    announceUri: string;
    /**
     * 转发发生的时间（Unix 秒）。
     * 前端据此把「被转发的帖子」按转发时间排序（算作最新）；
     * 取消转发后 announcer 变 null，自然回落到原帖时间。
     */
    createdAt: number;
}

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
 * 五条辅助查询互不依赖，用 `batch()` 合成一次往返：D1 每次查询都有固定开销，
 * 合并后省掉多次网络往返（文档也建议用 batch 摊薄 per-request 开销）。
 *
 * 转发：时间线里同一条帖子可能以「某人转发了它」的形式出现。
 * 调用方传入 `announceByNoteId`（noteId → 转发者信息），这里只负责把它填进返回项；
 * 转发数由本函数统一批量统计，避免每个调用方各查一次。
 *
 * 返回项的字段由调用方（各 route 文件）声明的响应接口约定，这里不单独定义接口。
 */
export async function toNoteListItems(
    rows: NoteRow[],
    viewerId?: number,
    /** noteId → 转发这条帖子的信息（时间线用）；没有转发的帖子不传 */
    announceByNoteId?: Map<number, AnnouncedBy>,
) {
    if (rows.length === 0) {
        return [];
    }

    const db = getDBClient();
    const noteIds = rows.map(row => row.id);
    const actorUrls = rows.map(row => row.actor);
    const noteUris = rows.map(row => row.uri);

    // 批量取作者 / 统计回复数 / 统计点赞数 / 当前用户赞过哪些 / 统计转发数 / 当前用户转发过哪些，一次往返
    const [authors, replyRows, likeRows, liked, announceRows, boosted] = await db.batch([
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
        // 未登录时用一个恒空的条件代替这条查询，保持 batch 形状稳定
        viewerId
            ? db.select({ noteId: likes.noteId }).from(likes).where(
                and(
                    inArray(likes.noteId, noteIds),
                    eq(likes.userId, viewerId),
                ),
            )
            : db.select({ noteId: likes.noteId }).from(likes).where(eq(likes.noteId, -1)),
        // 每条帖子被转发了多少次
        db.select({ noteId: announces.noteId, value: count() })
            .from(announces)
            .where(inArray(announces.noteId, noteIds))
            .groupBy(announces.noteId),
        // 当前用户转发过其中哪些（决定按钮亮不亮）
        viewerId
            ? db.select({ noteId: announces.noteId }).from(announces).where(
                and(
                    inArray(announces.noteId, noteIds),
                    eq(announces.userId, viewerId),
                ),
            )
            : db.select({ noteId: announces.noteId }).from(announces).where(eq(announces.noteId, -1)),
    ]);

    const userByActor = new Map(authors.map(user => [user.actorUrl, user]));
    const countByUri = new Map(replyRows.map(row => [row.inReplyTo, row.value]));
    const likeCountByNote = new Map(likeRows.map(row => [row.noteId, row.value]));
    const announceCountByNote = new Map(announceRows.map(row => [row.noteId, row.value]));
    const likedNoteIds = new Set(liked.map(row => row.noteId));
    const boostedNoteIds = new Set(boosted.map(row => row.noteId));

    return rows.map(row => {
        const author = userByActor.get(row.actor);
        // 转发信息（如果这条是作为「被转发」出现的）
        const announcedBy = announceByNoteId?.get(row.id);
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
            // 被转发次数
            announceCount: announceCountByNote.get(row.id) ?? 0,
            // 当前用户是否已转发（决定转发按钮亮不亮）
            boosted: boostedNoteIds.has(row.id),
            // 非空表示这条在时间线里以「某人转发了它」的形式出现
            announcedBy: announcedBy ?? null,
            createdAt: row.createdAt,
        };
    });
}

/** 按 uri 查本地已有的帖子行 */
export async function findNoteByUri(uri: string) {
    const db = getDBClient();
    return (await db.select().from(notes).where(eq(notes.uri, uri)))[0];
}

/**
 * 按需抓取一条远程帖子并落库。
 *
 * 使用场景：收到 `Announce` 时，被转发的原帖可能来自**另一台实例**
 * （对方转的是别人的帖子），本地库里没有这条记录。此时按 uri 主动拉取，
 * 拿到内容后才能把它作为转发条目展示在时间线上。
 *
 * 为什么不做成通用后台任务：抓取是「为了展示这条转发」才需要的，
 * 只有遇到 Announce 这类确实需要原帖内容的场景才触发，不值得为每条活动都跑。
 *
 * 返回本地 `notes` 行；抓不到（对方 404 / 内容不是 Note / 网络失败）时返回 undefined。
 *
 * @param noteUri  被转发帖子的 uri
 * @param privateKey 签名用私钥（部分实例只对已签名的请求返回内容）
 * @param keyId      签名身份
 */
export async function fetchRemoteNote(
    noteUri: string,
    privateKey: string,
    keyId: string,
): Promise<NoteRow | undefined> {
    // 可能已被别的请求抢先落库（同一帖子被多人转发时会并发走到这里）
    const existing = await findNoteByUri(noteUri);
    if (existing) return existing;

    // 拉取远程 Note 文档。
    // 用 getApObject 而不是 getActor：这里要取的是 Note 对象，不是 Actor。
    // 优先签名请求：不少实例（Mastodon 默认开启 AUTHORIZED_FETCH）会拒绝匿名请求，
    // 签名后拿到的成功率明显更高。
    let res: Response;
    try {
        res = await getApObject(noteUri, privateKey, keyId);
    } catch {
        return undefined;
    }

    if (!res.ok) return undefined;

    let obj: APNote;
    try {
        obj = await res.json<APNote>();
    } catch {
        return undefined;
    }

    // 只接受 Note：对方可能返回其它类型（Article / Question / 甚至 Actor）
    if (!obj || obj.type !== "Note" || !obj.id) return undefined;

    // 帖子作者可能也还没落库（转的是第三方实例的帖子）。
    // 作者信息是 feed 展示的必需字段，所以先抓 Actor 并落库。
    //
    // attributedTo 有两种形态：uri 字符串（常见），或内嵌的 Actor 对象（少数实现）。
    // 内嵌时直接用它的 id，不必再发一次网络请求。
    let actorUrl: string | undefined;
    if (typeof obj.attributedTo === "string") {
        actorUrl = obj.attributedTo;
    } else if (obj.attributedTo && typeof obj.attributedTo === "object") {
        const embedded = obj.attributedTo;
        actorUrl = embedded.id;
        // 内嵌对象已含公钥等信息，可直接落库，省一次请求
        if (embedded.type === "Person" && (embedded as any).publicKey) {
            try {
                await storeRemoteActor(embedded as any);
            } catch {
                // 落库失败不阻断，下面还会按 uri 再抓一次
            }
        }
    }
    if (!actorUrl) return undefined;

    // 本地已有这个作者就不再重复抓取（同一作者常有多条帖子被转发）
    const db = getDBClient();
    const existingAuthor = (await db.select().from(users).where(eq(users.actorUrl, actorUrl)))[0];
    if (!existingAuthor) {
        try {
            const actorRes = await getActor(actorUrl, privateKey, keyId);
            if (actorRes.ok) {
                await storeRemoteActor(await actorRes.json());
            }
        } catch {
            // Actor 抓取失败也继续：帖子本身能存，只是作者显示为空
        }
    }

    // 保留远端原始发布时间；解析失败则用当前时间
    const publishedMs = obj.published ? new Date(obj.published).getTime() : NaN;
    const createdAt = Number.isFinite(publishedMs)
        ? Math.floor(publishedMs / 1000)
        : Math.floor(Date.now() / 1000);

    const attachments = parseAttachments(obj.attachment, obj.sensitive === true);

    // 并发下可能被别的请求先插入：uri 是唯一键，冲突时退回读取已存在的那条
    try {
        const inserted = (await getDBClient().insert(notes).values({
            uri: obj.id,
            uuid: crypto.randomUUID(),
            actor: actorUrl,
            content: obj.content ?? "",
            inReplyTo: obj.inReplyTo ?? null,
            attachment: serializeAttachments(attachments),
            createdAt,
        }).returning())[0];
        return inserted;
    } catch {
        return await findNoteByUri(noteUri);
    }
}
