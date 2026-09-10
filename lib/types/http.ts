export type NotificationType = "follow" | "like" | "boost" | "mention";

export interface JwtPayload {
    [key: string]: unknown;
    sub?: string;
    iss?: string;
    aud?: string;
    iat?: number;
    exp?: number;
    nbf?: number;
    jti?: string;
}

export interface UserJwtPayload extends JwtPayload {
    username: string,
}

export interface AuthBody {
    username: string;
    password: string;
}

export interface AuthToken {
    username: string;
    token: string;
}

export interface SearchResult {
    users: SearchUser[];
}

export interface SearchUser {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    /** null 表示本站用户 */
    instance: string | null;
    actorUrl: string | null;
    followers: number;
    following: number;
    postsCount: number;
}

export interface User {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl?: string;
    instance: string;
    /** Actor URL，未知的用户可省略（发 Follow 时服务端兜底） */
    actorUrl?: string;
    followers: number;
    following: number;
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

export interface Notification {
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

export interface UserProfile {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    instance: string | null;
    actorUrl: string | null;
    followers: number;
    followingCount: number;
    postsCount: number;
    createdAt: string;
}
