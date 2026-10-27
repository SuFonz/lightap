import type { User } from "@/web/types";

/**
 * 目录唯一键：`username@domain`。
 *
 * 本地用户的 `domain` 是 `null`，用 `instance` 补上，所以本地 / 远程**同名不会互相覆盖**。
 * `User` 对象本身不存这个 key，需要时用本函数按 `username` + `domain/instance` 拼。
 */
export function userKey(user: Pick<User, "username" | "domain" | "instance">): string {
    return `${user.username}@${user.domain ?? user.instance}`;
}

/**
 * 帖子列表的缓存键：远程用户带 `domain`，本地用户只有 `username`。
 *
 * 资料页只用 `username` 做键时，远程 `admin` 会覆盖本地 `admin` 的列表
 * （反之亦然），所以这里把 `domain` 也纳进来区分同名用户。
 */
export function postsKey(username: string, domain?: string | null): string {
    return domain ? `${username}@${domain}` : username;
}

/** 资料页地址：远程用户带 `?domain=` 以区分同名，本地不带 */
export function profileHref(user: Pick<User, "username" | "domain">): string {
    const base = `/u/${encodeURIComponent(user.username)}`;
    return user.domain ? `${base}?domain=${encodeURIComponent(user.domain)}` : base;
}
