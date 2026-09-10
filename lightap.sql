-- 删除旧表
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS objects;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS oauth_codes;
DROP TABLE IF EXISTS oauth_tokens;
DROP TABLE IF EXISTS oauth_refresh_tokens;
DROP TABLE IF EXISTS oauth_grants;

-- 创建 users 表
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    actor_url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    preferred_username TEXT NOT NULL,
    summary TEXT,
    icon_url TEXT,
    public_key_pem TEXT NOT NULL,
    private_key_pem TEXT,
    password_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建 objects 表
CREATE TABLE objects (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);


-- 创建 activities 表
CREATE TABLE activities (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    object INTEGER NOT NULL,

    -- Test
    to_json TEXT,
    cc_json TEXT,

    created_at INTEGER NOT NULL,
    FOREIGN KEY (object) REFERENCES objects(id)
);

-- CREATE TABLE activity_recipients (
--     activity_id TEXT NOT NULL,
--     recipient TEXT NOT NULL,
--     field TEXT NOT NULL, -- to/cc
--     FOREIGN KEY(activity_id) REFERENCES activities(id)
-- );


CREATE TABLE follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower TEXT NOT NULL,   -- 谁关注别人
    following TEXT NOT NULL,  -- 被关注的人
    created_at INTEGER NOT NULL,
    UNIQUE(follower, following)
);

-- OAuth
CREATE TABLE oauth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_oauth_codes_expire
ON oauth_codes(expires_at);

CREATE TABLE oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
);
CREATE INDEX idx_oauth_tokens_user
ON oauth_tokens(user_id);

CREATE TABLE oauth_refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
);

CREATE TABLE oauth_grants (
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER,
    PRIMARY KEY(user_id, client_id)
);
