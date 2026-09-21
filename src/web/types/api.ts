/**
 * 后端 HTTP 契约。
 * 与 `app/(backend)/api/v1` 下的真实请求 / 响应一一对应，改动需与后端同步。
 */

/** 后端统一的错误响应体 */
export interface ApiErrorBody {
    error: string;
}

// 认证：POST /api/v1/login、POST /api/v1/register
export interface AuthRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
}

// 搜索：GET /api/v1/search?q=@user@domain
export interface SearchUserItem {
    username: string;
    /** 本地用户为 null，远端用户为实例域名 */
    domain: string | null;
    displayName: string;
    avatarUrl: string;
    actorUrl: string;
    originalUrl: string;
    /** 当前登录用户是否已关注该账号 */
    isFollowing: boolean;
}

export interface SearchResponse {
    items: SearchUserItem[];
}

// 用户资料：GET /api/v1/users/[username]
export interface UserProfileResponse {
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    actorUrl: string;
    domain: string | null;
    instance: string;
    postsCount: number;
    followingCount: number;
    followersCount: number;
    isFollowing: boolean;
    createdAt: number;
}

// 时间线：GET /api/v1/feed?type=all|local|following
export interface FeedItem {
    id: number;
    uri: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    domain: string;
    content: string;
    inReplyTo: string | null;
    createdAt: number;
}

export interface FeedResponse {
    items: FeedItem[];
}

// 发帖：POST /api/v1/notes
export interface CreateNoteRequest {
    content: string;
    /** 被回复帖子的 uri，非回复时省略 */
    inReplyTo?: string;
}

// 帖子线程：GET /api/v1/notes/[id]
export interface NoteItem {
    uri: string;
    username: string;
    domain: string;
    content: string;
    inReplyTo: string | null;
}

export interface NoteThreadResponse {
    /** 从顶层到当前帖，按顺序排列 */
    chain: NoteItem[];
    /** 当前帖的直接回复 */
    replies: NoteItem[];
}

// 关注：POST /api/v1/follow
export interface FollowRequest {
    username: string;
    domain: string;
    targetActorUrl: string;
}

// 取关：POST /api/v1/unfollow
export interface UnfollowRequest {
    username: string;
    domain: string;
}
