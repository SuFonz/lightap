import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { APActivityType, APObjectType } from "@/src/activitypub/ap"
import { NotificationType } from "../lib/notifications";

/**
 * 索引说明（每条都对应一个真实查询，不加没有使用者的索引）：
 *
 * - SQLite 里 `is null` 也能用索引，所以复合索引带上 `deleted_at`，
 *   `where deleted_at is null` 这类过滤能直接走索引。
 * - 列顺序按「等值列在前、排序列在后」排，兼顾 `order by id desc` 分页。
 */
export const users = sqliteTable("users", {
    id: integer().primaryKey({ autoIncrement: true }),
    username: text().notNull(),
    domain: text().notNull(),
    displayName: text("display_name"),
    // 总结
    summary: text(),
    // 头像
    avatarUrl: text("avatar_url"),
    // Actor Url
    actorUrl: text("actor_url").notNull().unique(),
    // ActivityPub 密钥
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    // 登录密码
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    // 登录 / 资料页 / WebFinger / inbox：按 username + domain 精确定位
    index("idx_users_username_domain").on(table.username, table.domain),
    // 本地时间线：按 domain 取本站用户
    index("idx_users_domain").on(table.domain),
]);

export const activities = sqliteTable("activities", {
    id: integer().primaryKey({ autoIncrement: true }),
    uri: text().notNull().unique(),
    type: text().$type<APActivityType>().notNull(),
    actor: text().notNull(),
    objectUri: text("object_uri"), // object 可能是一个链接
    objectId: integer("object_id"), // 也可能是一个对象，与其他表相关
    objectType: text("object_type").$type<APObjectType>(), // 与其他表相关
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    // 取关时按 actor + type + object_uri 找最新一条 Follow
    index("idx_activities_actor_type_object").on(table.actor, table.type, table.objectUri),
]);

export const notes = sqliteTable("notes", {
    id: integer().primaryKey({ autoIncrement: true }),
    uuid: text().notNull().unique(),
    uri: text().notNull().unique(),
    actor: text().notNull(),
    content: text().notNull(),
    inReplyTo: text(),
    /**
     * 远程帖子的附件（图片/视频/音频/文件），JSON 数组字符串。
     * 只有联邦进来的帖子会有值，本站发帖不产生附件（上传功能不在范围内）。
     * 结构见 src/lib/attachments.ts 的 NoteAttachment。
     */
    attachment: text(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    deletedAt: integer("deleted_at"),
}, (table) => [
    // 回复计数 / 线程回复列表
    index("idx_notes_in_reply_to").on(table.inReplyTo, table.deletedAt),
    // 用户帖子列表 / 用户帖子计数
    index("idx_notes_actor").on(table.actor, table.deletedAt),
    // 全站时间线：按 id 倒序分页，只取未删除
    index("idx_notes_deleted_id").on(table.deletedAt, table.id),
]);

// TODO: 会考虑做成 id 而不是 uri
export const follows = sqliteTable("follows", {
    id: integer().primaryKey({ autoIncrement: true }),
    follower: text().notNull(),
    following: text().notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    unique().on(table.follower, table.following),
    // 粉丝列表 / 粉丝计数；follower 侧已被上面的 unique 索引覆盖
    index("idx_follows_following").on(table.following),
]);

export const likes = sqliteTable("likes", {
    id: integer().primaryKey({ autoIncrement: true }),
    uri: text().notNull().unique(),
    userId: integer("user_id").notNull().references(() => users.id),
    noteId: integer("note_id").notNull().references(() => notes.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    // 一个索引同时服务「批量点赞计数」与「当前用户是否赞过」
    index("idx_likes_note_user").on(table.noteId, table.userId),
]);

export const notifications = sqliteTable("notifications", {
    id: integer().primaryKey({ autoIncrement: true }),
    // 收到通知的用户
    userId: integer("user_id").notNull().references(() => users.id),
    // 触发通知的用户
    actorId: integer("actor_id").notNull().references(() => users.id),
    type: text().$type<NotificationType>().notNull(),
    noteId: integer("note_id").references(() => notes.id),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    // 通知列表：按 user_id 过滤 + 按 id 倒序分页
    index("idx_notifications_user_id").on(table.userId, table.id),
]);

/**
 * 转发（ActivityPub 的 Announce / Mastodon 的 boost / Misskey 的 renote）。
 *
 * 语义：某个用户把一条已有帖子转到自己的时间线。原帖内容不复制，
 * 只记录「谁转了哪条」，渲染时把原帖内容取出来复用。
 *
 * 唯一约束放在 `(userId, noteId)` 上：同一个人对同一条帖子只能转发一次，
 * 取消转发就是删掉这一行，再次转发会插入新行（新的 uri / 新的时间）。
 */
export const announces = sqliteTable("announces", {
    id: integer().primaryKey({ autoIncrement: true }),
    // Announce 活动的 uri（联邦投递时用）
    uri: text().notNull().unique(),
    // 转发者
    userId: integer("user_id").notNull().references(() => users.id),
    // 被转发的帖子
    noteId: integer("note_id").notNull().references(() => notes.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    // 幂等：同一用户对同一帖子只能有一条转发记录
    unique().on(table.userId, table.noteId),
    // 时间线按时间倒序取转发；noteId 侧服务「这条帖子被转发了多少次」
    index("idx_announces_created").on(table.createdAt, table.id),
    index("idx_announces_note").on(table.noteId),
]);
