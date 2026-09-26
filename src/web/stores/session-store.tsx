"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { authApi } from "@/web/lib/api";
import type { Session } from "@/web/types";

interface SessionValue {
    session: Session | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function instanceHost(): string {
    return typeof window === "undefined" ? "" : window.location.host;
}

export function SessionProvider({
    initialSession = null,
    children,
}: {
    initialSession?: Session | null;
    children: ReactNode;
}) {
    const [session, setSession] = useState<Session | null>(initialSession);

    const applySession = useCallback((next: Session | null) => {
        // cookie 由服务端下发/清除，这里只更新客户端状态
        setSession(next);
    }, []);

    const login = useCallback(
        async (username: string, password: string) => {
            await authApi.login({ username, password });
            // JWT 在 HttpOnly cookie 里，客户端只记用户名
            applySession({ username, instance: instanceHost() });
        },
        [applySession],
    );

    const register = useCallback(
        async (username: string, password: string) => {
            await authApi.register({ username, password });
            applySession({ username, instance: instanceHost() });
        },
        [applySession],
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // 后端登出失败也照常清理本地会话
        }
        applySession(null);
    }, [applySession]);

    const value = useMemo<SessionValue>(
        () => ({
            session,
            isAuthenticated: session !== null,
            login,
            register,
            logout,
        }),
        [session, login, register, logout],
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSession must be used within SessionProvider");
    return ctx;
}
