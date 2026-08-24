export interface UserRow {
    id: number,
    username: string,
    preferred_username: string,
    summary: string | null,
    icon_url: string | null,
    private_key_pem: string | null,
    public_key_pem: string,
    created_at: Date,
    updated_at: Date,
}

