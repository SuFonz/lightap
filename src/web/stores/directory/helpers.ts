import type { SearchUserItem, User } from "@/web/types";

/** 未登录时的占位用户。 */
export const GUEST: User = {
    username: "",
    displayName: "游客",
    domain: null,
    instance: "",
    actorUrl: "",
    bio: "",
    postsCount: 0,
    followingCount: 0,
    followersCount: 0,
};

export function makeLocalUser(username: string, instance: string, patch?: Partial<User>): User {
    return {
        username,
        displayName: username,
        domain: null,
        instance,
        actorUrl: instance ? `https://${instance}/users/${username}` : "",
        bio: "",
        postsCount: 0,
        followingCount: 0,
        followersCount: 0,
        ...patch,
    };
}

export function makeRemoteUser(item: SearchUserItem, localInstance: string): User {
    return {
        username: item.username,
        displayName: item.displayName || item.username,
        avatarUrl: item.avatarUrl || undefined,
        domain: item.domain,
        instance: item.domain ?? localInstance,
        actorUrl: item.actorUrl,
        bio: "",
        postsCount: 0,
        followingCount: 0,
        followersCount: 0,
    };
}
