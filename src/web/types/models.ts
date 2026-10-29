/** 前端领域模型，组件直接消费的数据结构，与后端契约解耦。 */

export interface Session {
    username: string;
    /** 当前实例域名，用于展示 @username@instance */
    instance: string;
}

export type AuthMode = "login" | "register";

export interface User {
    username: string;
    displayName: string;
    avatarUrl?: string;
    /** 远端实例域名，本地用户为 null */
    domain: string | null;
    /** 展示用的实例名 */
    instance: string;
    actorUrl: string;
    bio: string;
    postsCount: number;
    followingCount: number;
    followersCount: number;
}

/** 帖子附件（远程帖子的图片/视频/音频/文件） */
export interface PostAttachment {
    kind: "image" | "video" | "audio" | "document";
    url: string;
    mediaType?: string;
    /** alt 文本 / 文件名 */
    name?: string;
    width?: number;
    height?: number;
}

/** 时间线里「这条帖子是谁转发的」 */
export interface PostAnnouncer {
    username: string;
    displayName: string;
    avatarUrl: string;
    /** 转发者所在实例 */
    domain: string;
}

export interface Post {
    id: string;
    /** ActivityPub 规范地址（回复时作为 inReplyTo 传回后端） */
    uri: string;
    /** 后端数字 id，仅列表项有，用作分页游标 */
    cursorId?: number;
    authorUsername: string;
    /** 作者所在实例域名（用于按 tab 过滤「本地」） */
    domain?: string;
    /** 这条「实时帖」在服务端判断下属于哪些 tab（客户端按此过滤） */
    tabs?: FeedTab[];
    content: string;
    createdAt: string;
    /** 被回复帖子的 id，非回复时省略 */
    inReplyTo?: string;
    /** 远程帖子的附件；本站帖子为空 */
    attachment?: PostAttachment[];
    /** 非空表示这条在时间线里是「某人转发了它」 */
    announcer?: PostAnnouncer;
    /**
     * 转发时间（ISO 字符串），仅在有 announcer 时有值。
     * 时间线排序用它：转发过的帖子按转发时间算「最新」；
     * 取消转发后 announcer / announcedAt 一起清空，自动回落到原帖 createdAt。
     */
    announcedAt?: string;
    replies: Post[];
    repliesCount: number;
    likes: number;
    boosts: number;
    likedByMe: boolean;
    boostedByMe: boolean;
}

export type FeedTab = "all" | "local" | "following";

export type PostVariant = "default" | "context";

/** 关注 / 粉丝列表的方向 */
export type FollowDirection = "following" | "followers";

/**
 * 关注 / 粉丝列表里的一个人。
 *
 * 比 `User` 轻：列表不需要帖子数、关注数这些统计，
 * 而每个统计都要额外聚合查询，列表页会放大成 N 次。
 */
export interface FollowUser {
    username: string;
    displayName: string;
    avatarUrl: string;
    /** 所在实例域名（本地用户也是真实 host，便于统一展示 @user@host） */
    domain: string;
    bio: string;
    actorUrl: string;
    /** 分页游标（follows.id），下一页的 maxId 取最后一项的值 */
    cursorId: number;
}
