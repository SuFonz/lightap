"use client";

import { useState, type ReactNode } from "react";
import { ComposerModal } from "@/components/composer-modal";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { MobileBottomNav, MobileDrawer, MobileTopBar } from "@/components/mobile-nav";
import { RightRail } from "@/components/right-rail";
import { ShellContext, type ShellValue } from "@/components/shell-context";
import { Sidebar } from "@/components/sidebar";
import { StoreProvider } from "@/components/store";

export function AppShell({ children }: { children: ReactNode }) {
    const [composerOpen, setComposerOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const shell: ShellValue = {
        openComposer: () => setComposerOpen(true),
        closeComposer: () => setComposerOpen(false),
        openEditProfile: () => setEditOpen(true),
        drawerOpen,
        setDrawerOpen,
    };

    return (
        <ShellContext.Provider value={shell}>
            <StoreProvider>
                <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
                    <div className="blob absolute -top-32 -left-24 h-96 w-96 bg-sky-300/50" />
                    <div className="blob absolute top-1/4 -right-28 h-[420px] w-[420px] bg-indigo-300/40" style={{ animationDelay: "-6s" }} />
                    <div className="blob absolute -bottom-36 left-1/3 h-[380px] w-[380px] bg-pink-200/45" style={{ animationDelay: "-11s" }} />
                </div>

                <MobileTopBar />
                <MobileDrawer />

                <div className="mx-auto flex w-full max-w-[1240px] gap-6 px-4 pb-32 pt-[72px] sm:px-6 lg:pb-12 lg:pt-6">
                    <Sidebar />
                    <main className="min-w-0 flex-1">{children}</main>
                    <RightRail />
                </div>

                <MobileBottomNav />
                <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} />
                <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
            </StoreProvider>
        </ShellContext.Provider>
    );
}
