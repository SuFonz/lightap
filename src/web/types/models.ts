/** 前端领域模型，组件直接消费的数据结构，与后端契约解耦。 */

export interface Session {
    username: string;
    token: string;
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

export interface Post {
    id: string;
    authorUsername: string;
    content: string;
    createdAt: string;
    /** 被回复帖子的 id，非回复时省略 */
    inReplyTo?: string;
    replies: Post[];
    likes: number;
    boosts: number;
    likedByMe: boolean;
    boostedByMe: boolean;
}

export type FeedTab = "all" | "local" | "following";

export type PostVariant = "default" | "context";
