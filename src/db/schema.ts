import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { APActivityType, APObjectType } from "@/src/activitypub/ap"

export const users = sqliteTable("users", {
    id: integer().primaryKey({ autoIncrement: true }),
    username: text().notNull(),
    domain: text().notNull(),
    displayName: text("display_name").notNull(),
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
});

export const activities = sqliteTable("activities", {
    id: integer().primaryKey({ autoIncrement: true }),
    uri: text().notNull().unique(),
    type: text().$type<APActivityType>().notNull(),
    actor: text().notNull(),
    objectUri: text("object_uri"), // object 可能是一个链接
    objectId: integer("object_id"), // 也可能是一个对象，与其他表相关
    objectType: text("object_type").$type<APObjectType>(), // 与其他表相关
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const notes = sqliteTable("notes", {
    id: integer().primaryKey({ autoIncrement: true }),
    uuid: text().notNull().unique(),
    uri: text().notNull().unique(),
    actor: text().notNull(),
    content: text().notNull(),
    inReplyTo: text(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
})

export const follows = sqliteTable("follows", {
    id: integer().primaryKey({ autoIncrement: true }),
    follower: text().notNull(),
    following: text().notNull(),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
    unique().on(table.follower, table.following),
]);

export const likes = sqliteTable("likes", {
    id: integer().primaryKey({ autoIncrement: true }),
    uri: text().notNull().unique(),
    userId: integer("user_id").notNull().references(() => users.id),
    noteId: integer("note_id").notNull().references(() => notes.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
})
