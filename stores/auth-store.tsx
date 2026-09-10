"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as authApi from "@/lib/client/api";
import {
    SESSION_TOKEN_COOKIE,
    SESSION_USERNAME_COOKIE,
    SESSION_MAX_AGE,
    takeLegacySession,
    type SessionInfo,
} from "@/lib/session";

export type AuthMode = "login" | "register";

interface AuthStoreValue {
    isAuthenticated: boolean;
    username: string | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthStoreContext = createContext<AuthStoreValue | null>(null);

function writeSessionCookies(session: SessionInfo) {
    // token(JWT) 与用户名字符集均为 cookie 安全字符，无需编码
    document.cookie = `${SESSION_TOKEN_COOKIE}=${session.token}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
    document.cookie = `${SESSION_USERNAME_COOKIE}=${session.username}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
}

function clearSessionCookies() {
    document.cookie = `${SESSION_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
    document.cookie = `${SESSION_USERNAME_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function AuthProvider({
    children,
    initialSession = null,
}: {
    children: ReactNode;
    initialSession?: SessionInfo | null;
}) {
    // SSR 时由根布局从 cookie 读出并传入，首帧即登录态，无注水不一致
    const [session, setSession] = useState<SessionInfo | null>(initialSession);

    useEffect(() => {
        // 一次性迁移旧版 localStorage 会话
        const legacy = takeLegacySession();
        if (legacy && !session) {
            writeSessionCookies(legacy);
            setSession(legacy);
            return;
        }

        // 启动时校验 token 是否仍然有效，失效则清除会话
        if (!session) return;
        let cancelled = false;
        authApi
            .me(session.token)
            .then((name) => {
                if (!cancelled && !name) {
                    clearSessionCookies();
                    setSession(null);
                }
            })
            .catch(() => {
                // 网络异常时保留本地会话
            });
        return () => {
            cancelled = true;
        };
        // 仅在挂载时执行一次（迁移 + 校验）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(async (name: string, password: string) => {
        const res = await authApi.login(name, password);
        const next = { username: res.username, token: res.token };
        writeSessionCookies(next);
        setSession(next);
    }, []);

    const register = useCallback(async (name: string, password: string) => {
        const res = await authApi.register(name, password);
        const next = { username: res.username, token: res.token };
        writeSessionCookies(next);
        setSession(next);
    }, []);

    const logout = useCallback(() => {
        clearSessionCookies();
        setSession(null);
    }, []);

    const username = session?.username ?? null;
    const isAuthenticated = Boolean(session);

    const value = useMemo(
        () => ({
            isAuthenticated,
            username,
            token: session?.token ?? null,
            login,
            register,
            logout,
        }),
        [isAuthenticated, username, session, login, register, logout],
    );

    return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStore() {
    const ctx = useContext(AuthStoreContext);
    if (!ctx) throw new Error("useAuthStore must be used within AuthProvider");
    return ctx;
}
