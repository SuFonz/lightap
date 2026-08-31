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

interface AuthStoreValue {
    isAuthenticated: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const SESSION_KEY = "lightap:session";
const AuthStoreContext = createContext<AuthStoreValue | null>(null);

function readSession(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(SESSION_KEY);
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [username, setUsername] = useState<string | null>(() => readSession());
    const isAuthenticated = Boolean(username);

    useEffect(() => {
        try {
            if (username) window.localStorage.setItem(SESSION_KEY, username);
            else window.localStorage.removeItem(SESSION_KEY);
        } catch {
            // localStorage 不可用时静默忽略
        }
    }, [username]);

    const login = useCallback(async (name: string, password: string) => {
        const res = await authApi.login(name, password);
        setUsername(res.username);
    }, []);

    const register = useCallback(async (name: string, password: string) => {
        const res = await authApi.register(name, password);
        setUsername(res.username);
    }, []);

    const logout = useCallback(() => setUsername(null), []);

    const value = useMemo(
        () => ({ isAuthenticated, username, login, register, logout }),
        [isAuthenticated, username, login, register, logout],
    );

    return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStore() {
    const ctx = useContext(AuthStoreContext);
    if (!ctx) throw new Error("useAuthStore must be used within AuthProvider");
    return ctx;
}
