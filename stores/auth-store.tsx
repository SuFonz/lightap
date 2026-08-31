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
import * as authApi from "@/lib/client/auth-api";

export type AuthMode = "login" | "register";

interface Session {
    username: string;
    token: string;
}

interface AuthStoreValue {
    isAuthenticated: boolean;
    username: string | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const SESSION_KEY = "lightap:session";
const AuthStoreContext = createContext<AuthStoreValue | null>(null);

function readSession(): Session | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Session>;
        if (!parsed.username || !parsed.token) return null;
        return { username: parsed.username, token: parsed.token };
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(() => readSession());
    const username = session?.username ?? null;
    const isAuthenticated = Boolean(session);

    useEffect(() => {
        try {
            if (session) {
                window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } else {
                window.localStorage.removeItem(SESSION_KEY);
            }
        } catch {
            // localStorage 不可用时静默忽略
        }
    }, [session]);

    // 启动时校验 token 是否仍然有效，失效则清除会话
    useEffect(() => {
        if (!session) return;
        authApi
            .me(session.token)
            .then((name) => {
                if (!name) setSession(null);
            })
            .catch(() => {
                // 网络异常时保留本地会话
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(async (name: string, password: string) => {
        const res = await authApi.login(name, password);
        setSession({ username: res.username, token: res.token });
    }, []);

    const register = useCallback(async (name: string, password: string) => {
        const res = await authApi.register(name, password);
        setSession({ username: res.username, token: res.token });
    }, []);

    const logout = useCallback(() => setSession(null), []);

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
