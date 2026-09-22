"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { AuthMode } from "@/web/types";

/** 全局轻提示的显示时长 */
const TOAST_DURATION = 3000;

interface UiValue {
    // 发帖弹窗
    composerOpen: boolean;
    openComposer: () => void;
    closeComposer: () => void;

    // 登录 / 注册弹窗
    authOpen: boolean;
    authMode: AuthMode;
    openAuth: (mode?: AuthMode) => void;
    closeAuth: () => void;
    switchAuthMode: (mode: AuthMode) => void;

    // 编辑资料弹窗
    editProfileOpen: boolean;
    openEditProfile: () => void;
    closeEditProfile: () => void;

    // 移动端抽屉
    drawerOpen: boolean;
    setDrawerOpen: (open: boolean) => void;

    // 全局轻提示（如发送失败）
    toast: string | null;
    showToast: (message: string) => void;
    dismissToast: () => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
    const [composerOpen, setComposerOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [editProfileOpen, setEditProfileOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismissToast = useCallback(() => {
        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
            toastTimer.current = null;
        }
        setToast(null);
    }, []);

    const showToast = useCallback((message: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(message);
        toastTimer.current = setTimeout(() => {
            toastTimer.current = null;
            setToast(null);
        }, TOAST_DURATION);
    }, []);

    const openComposer = useCallback(() => setComposerOpen(true), []);
    const closeComposer = useCallback(() => setComposerOpen(false), []);
    const openAuth = useCallback((mode: AuthMode = "login") => {
        setAuthMode(mode);
        setAuthOpen(true);
    }, []);
    const closeAuth = useCallback(() => setAuthOpen(false), []);
    const openEditProfile = useCallback(() => setEditProfileOpen(true), []);
    const closeEditProfile = useCallback(() => setEditProfileOpen(false), []);

    const value = useMemo<UiValue>(
        () => ({
            composerOpen,
            openComposer,
            closeComposer,
            authOpen,
            authMode,
            openAuth,
            closeAuth,
            switchAuthMode: setAuthMode,
            editProfileOpen,
            openEditProfile,
            closeEditProfile,
            drawerOpen,
            setDrawerOpen,
            toast,
            showToast,
            dismissToast,
        }),
        [composerOpen, openComposer, closeComposer, authOpen, authMode, openAuth, closeAuth, editProfileOpen, openEditProfile, closeEditProfile, drawerOpen, toast, showToast, dismissToast],
    );

    return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
    const ctx = useContext(UiContext);
    if (!ctx) throw new Error("useUi must be used within UiProvider");
    return ctx;
}
