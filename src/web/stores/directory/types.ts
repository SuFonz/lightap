import type { User } from "@/web/types";

export interface RememberUserInput {
    username: string;
    domain?: string | null;
    displayName?: string;
    avatarUrl?: string;
}

export interface DirectoryValue {
    currentUser: User;
    /** 按 username + domain 取用户（domain 省略时按本站） */
    getUser: (username: string, domain?: string | null) => User | undefined;
    /** 记住一个轻量用户，displayName/avatarUrl 为可选补充信息 */
    rememberUser: (input: RememberUserInput) => void;
    search: (query: string) => Promise<User[]>;
    loadProfile: (username: string, domain?: string | null) => Promise<void>;
    isProfileMissing: (username: string, domain?: string | null) => boolean;
    isFollowing: (user: User) => boolean;
    toggleFollow: (user: User) => Promise<void>;
    updateProfile: (patch: Partial<Pick<User, "displayName" | "bio">>) => Promise<void>;
}
