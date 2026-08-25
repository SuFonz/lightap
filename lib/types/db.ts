export interface UserRow {
    id: string,
    name: string,
    preferred_username: string,
    summary: string | null,
    icon_url: string | null,
    private_key_pem: string | null,
    public_key_pem: string,
    created_at: Date,
    updated_at: Date,
}

export interface ObjectRow {
    id: string,
    name: string | null,
    type: string,
    actor_id: string,
    content: string,
    created_at: Date,
}

export interface ActivityRow {
    id: string,
    type: string,
    actor_id: string,
    object_id: string,
    to_json: string,
    cc_json: string,
    created_at: Date,
}
