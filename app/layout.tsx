import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/web/components/layout/app-shell";
import { SESSION_TOKEN_COOKIE, SESSION_USERNAME_COOKIE } from "@/web/lib/session";
import type { Session } from "@/web/types";
import "./globals.css";

export const metadata: Metadata = {
    title: "LightAP · 轻量 ActivityPub 社区",
    description: "一个可爱的去中心化联邦宇宙小站，基于 ActivityPub 协议。",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "#DDF3FF",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    // 会话存在 cookie 里，SSR 直接渲染登录态，避免注水不一致
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value ?? null;
    const username = cookieStore.get(SESSION_USERNAME_COOKIE)?.value ?? null;
    const instance = (await headers()).get("host") ?? "";
    const initialSession: Session | null = token && username ? { username, token, instance } : null;

    return (
        <html lang="zh-CN">
            <body>
                <AppShell initialSession={initialSession}>{children}</AppShell>
            </body>
        </html>
    );
}
