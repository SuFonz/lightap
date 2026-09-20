import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { APActivityType } from "@/src/activitypub/ap"

export const users = sqliteTable("users", {
    id: integer().primaryKey({ autoIncrement: true }),
    username: text().notNull(),
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
    objectId: integer("object_id"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const notes = sqliteTable("notes", {
    id: integer().primaryKey({ autoIncrement: true }),
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
