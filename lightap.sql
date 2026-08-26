-- 删除旧表
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS objects;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS follows;


-- 创建 users 表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    preferred_username TEXT NOT NULL,
    summary TEXT,
    icon_url TEXT,
    public_key_pem TEXT NOT NULL,
    private_key_pem TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建 objects 表
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);


-- 创建 activities 表
CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    object TEXT NOT NULL,

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
