"use client";

import { useEffect, type ReactNode } from "react";
import { AuthModal } from "@/web/components/auth/auth-modal";
import { ComposerModal } from "@/web/components/composer/composer-modal";
import { Background } from "@/web/components/layout/background";
import { MobileBottomNav, MobileDrawer, MobileTopBar } from "@/web/components/layout/mobile-nav";
import { RightRail } from "@/web/components/layout/right-rail";
import { Sidebar } from "@/web/components/layout/sidebar";
import { ToastViewport } from "@/web/components/ui/toast";
import { EditProfileModal } from "@/web/components/user/edit-profile-modal";
import { initHistoryBaseline } from "@/web/lib/nav-history";
import { useUi } from "@/web/stores/ui-store";

/** 站点外壳：三栏布局 + 各类全局弹窗。 */
export function ShellFrame({ children }: { children: ReactNode }) {
    const {
        composerOpen,
        closeComposer,
        authOpen,
        authMode,
        closeAuth,
        switchAuthMode,
        editProfileOpen,
        closeEditProfile,
    } = useUi();

    // 记录进入应用时的历史长度，供「返回键」判断应用内是否有跳转
    useEffect(() => {
        initHistoryBaseline();
    }, []);

    return (
        <>
            <Background />

            <MobileTopBar />
            <MobileDrawer />

            {/* 三栏：240px / 680px / 280px */}
            <div className="mx-auto flex w-full max-w-[1248px] gap-6 px-4 pb-32 pt-[72px] sm:px-6 lg:pb-12 lg:pt-6">
                <Sidebar />
                <main className="mx-auto min-w-0 w-full max-w-[680px] flex-1">{children}</main>
                <RightRail />
            </div>

            <MobileBottomNav />
            <ComposerModal open={composerOpen} onClose={closeComposer} />
            <EditProfileModal open={editProfileOpen} onClose={closeEditProfile} />
            <AuthModal
                open={authOpen}
                mode={authMode}
                onClose={closeAuth}
                onSwitchMode={switchAuthMode}
            />

            <ToastViewport />
        </>
    );
}
