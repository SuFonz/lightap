export interface UserRow {
    id: number,
    actor_url: string,
    name: string,
    preferred_username: string,
    summary: string | null,
    icon_url: string | null,
    private_key_pem: string | null,
    public_key_pem: string,
    password_hash: string | null,
    created_at: Date,
    updated_at: Date,
}

export interface ObjectRow {
    id: number,
    url: string,
    name: string | null,
    type: string,
    actor: string,
    to_json: string | null,
    cc_json: string | null,
    content: string,
    created_at: Date,
}

/** feed 查询结果：Note + 作者用户名 */
export interface FeedNoteRow extends ObjectRow {
    author_username: string,
}

export interface ActivityRow {
    id: number,
    type: string,
    actor: string,
    object: number,
    to_json: string | null,
    cc_json: string | null,
    created_at: Date,
}

export interface FollowRow {
    id: number,
    follower: string,
    following: string,
    created_at: Date,
}

export interface UserSearchRow {
    id: number,
    actor_url: string,
    name: string,
    preferred_username: string,
    summary: string | null,
    icon_url: string | null,
    created_at: number,
    followers_count: number,
    following_count: number,
    posts_count: number,
}
