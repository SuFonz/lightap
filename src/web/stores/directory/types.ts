import type { User } from "@/web/types";

export interface RememberUserInput {
    username: string;
    domain?: string | null;
    displayName?: string;
    avatarUrl?: string;
}

export interface DirectoryValue {
    currentUser: User;
    getUser: (username: string) => User | undefined;
    /** 记住一个轻量用户，displayName/avatarUrl 为可选补充信息 */
    rememberUser: (input: RememberUserInput) => void;
    search: (query: string) => Promise<User[]>;
    loadProfile: (username: string) => Promise<void>;
    isProfileMissing: (username: string) => boolean;
    isFollowing: (username: string) => boolean;
    toggleFollow: (user: User) => Promise<void>;
    updateProfile: (patch: Partial<Pick<User, "displayName" | "bio" | "avatarUrl">>) => Promise<void>;
}
