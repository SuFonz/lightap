import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/web/components/layout/app-shell";
import { SESSION_TOKEN_COOKIE, SESSION_USERNAME_COOKIE } from "@/web/lib/session";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/web/lib/i18n/dictionaries";
import type { Session } from "@/web/types";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
    const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    return locale === "en"
        ? {
              title: "LightAP · Lightweight ActivityPub community",
              description: "A cute, decentralized fediverse instance built on ActivityPub.",
          }
        : {
              title: "LightAP · 轻量 ActivityPub 社区",
              description: "一个可爱的去中心化联邦宇宙小站，基于 ActivityPub 协议。",
          };
}

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
    // JWT 只存在 HttpOnly cookie 里，不下发给客户端；客户端靠 cookie 鉴权
    const initialSession: Session | null = token && username ? { username, instance } : null;

    // 语言：cookie 里读，默认中文
    const rawLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    const initialLocale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

    return (
        <html lang={initialLocale === "en" ? "en" : "zh-CN"}>
            <body>
                <AppShell initialSession={initialSession} initialLocale={initialLocale}>{children}</AppShell>
            </body>
        </html>
    );
}
