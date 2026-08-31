"use client";

import { useState, type ReactNode } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
import { AuthProvider, type AuthMode } from "@/stores/auth-store";import { ComposerModal } from "@/components/composer-modal";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { MobileBottomNav, MobileDrawer, MobileTopBar } from "@/components/mobile-nav";
import { RightRail } from "@/components/right-rail";
import { ShellContext, type ShellValue } from "@/components/shell-context";
import { Sidebar } from "@/components/sidebar";
import { AppStoreProvider } from "@/stores/app-store-provider";
import type { SessionInfo } from "@/lib/session";

export function AppShell({
    children,
    initialSession = null,
}: {
    children: ReactNode;
    initialSession?: SessionInfo | null;
}) {
    const [composerOpen, setComposerOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>("login");

    const shell: ShellValue = {
        openComposer: () => setComposerOpen(true),
        closeComposer: () => setComposerOpen(false),
        openEditProfile: () => setEditOpen(true),
        openAuth: (mode) => {
            setAuthMode(mode);
            setAuthOpen(true);
        },
        drawerOpen,
        setDrawerOpen,
    };

    return (
        <ShellContext.Provider value={shell}>
            <AuthProvider initialSession={initialSession}>
                <AppStoreProvider>
                    {/* 第一层：环境 —— 蓝色天空 + 光晕 + 星光 */}
                    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
                        <div className="blob absolute -top-32 -left-24 h-96 w-96 bg-brand/25" />
                        <div
                            className="blob absolute top-1/4 -right-28 h-[420px] w-[420px] bg-magic/20"
                            style={{ animationDelay: "-6s" }}
                        />
                        <div
                            className="blob absolute -bottom-36 left-1/3 h-[380px] w-[380px] bg-sakura/20"
                            style={{ animationDelay: "-11s" }}
                        />
                        <span className="sparkle left-[8%] top-[16%] h-3 w-3" />
                        <span className="sparkle right-[14%] top-[28%] h-2 w-2" style={{ animationDelay: "-2s" }} />
                        <span className="sparkle left-[32%] bottom-[20%] h-2.5 w-2.5" style={{ animationDelay: "-3.5s" }} />
                        <span className="sparkle right-[32%] top-[9%] h-1.5 w-1.5" style={{ animationDelay: "-1.2s" }} />
                        <span className="sparkle left-[55%] bottom-[8%] h-2 w-2" style={{ animationDelay: "-4.2s" }} />
                    </div>

                    <MobileTopBar />
                    <MobileDrawer />

                    {/* 三栏：240px / 680px / 280px */}
                    <div className="mx-auto flex w-full max-w-[1248px] gap-6 px-4 pb-32 pt-[72px] sm:px-6 lg:pb-12 lg:pt-6">
                        <Sidebar />
                        <main className="mx-auto min-w-0 w-full max-w-[680px] flex-1">{children}</main>
                        <RightRail />
                    </div>

                    <MobileBottomNav />
                    <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} />
                    <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
                    <AuthModal
                        open={authOpen}
                        mode={authMode}
                        onClose={() => setAuthOpen(false)}
                        onSwitchMode={setAuthMode}
                    />
                </AppStoreProvider>
            </AuthProvider>
        </ShellContext.Provider>
    );
}
