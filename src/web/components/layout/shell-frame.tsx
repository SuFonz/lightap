"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
 // 路由变化时给中栏换一个 key，触发页面切换的入场过渡
 const pathname = usePathname();

 // 记录进入应用时的历史长度，供「返回键」判断应用内是否有跳转
 useEffect(() => {
 initHistoryBaseline();
 }, []);

 return (
 <>
 <Background />

 <MobileTopBar />
 <MobileDrawer />

 {/* 三栏都是平面，没有卡片边界。items-start 让两侧栏各自按内容高度 */}
 <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1180px] items-start gap-8 px-4 pb-32 pt-[72px] sm:px-6 lg:gap-10 lg:pb-20 lg:pt-8">
 <Sidebar />

 {/* 中栏：时间线直接融入页面，没有外层卡片。
     key=pathname + page-enter：切路由时整块轻微上浮淡入，
     让「换了一页」有交代，不再是硬切。
     只动 opacity/transform，不改变布局与滚动位置。 */}
 <main
 key={pathname}
 className="page-enter mx-auto min-w-0 w-full max-w-[640px] flex-1"
 >
 {children}
 </main>

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
