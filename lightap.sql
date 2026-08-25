-- 删除旧表
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS objects;
DROP TABLE IF EXISTS users;


-- 创建 users 表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    preferred_username TEXT NOT NULL,
    summary TEXT,
    icon_url TEXT,
    private_key_pem TEXT,
    public_key_pem TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);


-- 创建 objects 表
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);


-- 创建 activities 表
CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    object_id TEXT NOT NULL,
    to_json TEXT,
    cc_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);


-- 插入测试用户
INSERT INTO users (
    id,
    name,
    preferred_username,
    summary,
    icon_url,
    private_key_pem,
    public_key_pem,
    created_at,
    updated_at
)
VALUES
(
    'https://1e3e4b09ef3714.lhr.life/api/users/alice',
    'alice',
    'alice',
    'Alice test account',
    NULL,
    NULL,
    'PUBLIC_KEY_ALICE',
    CAST(unixepoch('subsec') * 1000 AS INTEGER),
    CAST(unixepoch('subsec') * 1000 AS INTEGER)
),
(
    'https://1e3e4b09ef3714.lhr.life/api/users/bob',
    'bob',
    'bob',
    'Bob test account',
    NULL,
    NULL,
    'PUBLIC_KEY_BOB',
    CAST(unixepoch('subsec') * 1000 AS INTEGER),
    CAST(unixepoch('subsec') * 1000 AS INTEGER)
),
(
    'https://1e3e4b09ef3714.lhr.life/api/users/charlie',
    'charlie',
    'charlie',
    'Charlie test account',
    NULL,
    NULL,
    'PUBLIC_KEY_CHARLIE',
    CAST(unixepoch('subsec') * 1000 AS INTEGER),
    CAST(unixepoch('subsec') * 1000 AS INTEGER)
),
(
    'https://1e3e4b09ef3714.lhr.life/api/users/me',
    'me',
    'me',
    'me test account',
    NULL,
    NULL,
    'PUBLIC_KEY_ME',
    CAST(unixepoch('subsec') * 1000 AS INTEGER),
    CAST(unixepoch('subsec') * 1000 AS INTEGER)
);