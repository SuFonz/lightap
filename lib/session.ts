export const SESSION_TOKEN_COOKIE = "lightap_token";
export const SESSION_USERNAME_COOKIE = "lightap_username";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const LEGACY_SESSION_KEY = "lightap:session";

export interface SessionInfo {
    username: string;
    token: string;
}

/**
 * 旧版 localStorage 会话迁移：读取并清除，避免残留
 */
export function takeLegacySession(): SessionInfo | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(LEGACY_SESSION_KEY);
        window.localStorage.removeItem(LEGACY_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<SessionInfo>;
        if (!parsed.username || !parsed.token) return null;
        return { username: parsed.username, token: parsed.token };
    } catch {
        return null;
    }
}
