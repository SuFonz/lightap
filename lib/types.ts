export interface User {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl?: string;
    instance: string;
    followers: number;
    followingCount: number;
    postsCount: number;
    /** 二次元风小徽章，如「插画师」 */
    badges?: string[];
    /** 在线状态 */
    online?: boolean;
}

export interface Post {
    id: string;
    authorUsername: string;
    content: string;
    createdAt: string;
    likes: number;
    likedByMe: boolean;
    boosts: number;
    boostedByMe: boolean;
    replies: Post[];
}

export type NotificationType = "follow" | "like" | "boost" | "mention";

export interface AppNotification {
    id: string;
    type: NotificationType;
    actorUsername: string;
    postId?: string;
    excerpt?: string;
    createdAt: string;
    read: boolean;
}

export interface TrendingTag {
    name: string;
    postsCount: number;
}
