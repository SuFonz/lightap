import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/web/components/layout/app-shell";
import { SESSION_TOKEN_COOKIE, SESSION_USERNAME_COOKIE } from "@/web/lib/session";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/web/lib/i18n/dictionaries";
import { THEME_INIT_SCRIPT } from "@/web/stores/theme-store";
import type { Session } from "@/web/types";
import "./globals.css";

/** 界面语言 → `<html lang>` 用的 BCP-47 标签 */
const HTML_LANG: Record<Locale, string> = {
 zh:"zh-CN",
 en:"en",
 ja:"ja",
};

/** 界面语言 → 站点标题与描述 */
const SITE_METADATA: Record<Locale, { title: string; description: string }> = {
 zh: {
  title:"LightAP · 轻量 ActivityPub 社区",
  description:"一个可爱的去中心化联邦宇宙小站，基于 ActivityPub 协议。",
 },
 en: {
  title:"LightAP · Lightweight ActivityPub community",
  description:"A cute, decentralized fediverse instance built on ActivityPub.",
 },
 ja: {
  title:"LightAP · 軽量な ActivityPub コミュニティ",
  description:"ActivityPub に基づく、かわいくて分散型のフェディバース拠点です。",
 },
};

export async function generateMetadata(): Promise<Metadata> {
 const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
 const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
 const { title, description } = SITE_METADATA[locale];
 return { title, description };
}

export const viewport: Viewport = {
 width:"device-width",
 initialScale: 1,
 // 主题色随明暗切换，交给下面的动态 meta
 themeColor: [
 { media:"(prefers-color-scheme: light)", color:"#E7F1FF" },
 { media:"(prefers-color-scheme: dark)", color:"#0E1220" },
 ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 // 会话存在 cookie 里，SSR 直接渲染登录态，避免注水不一致
 const cookieStore = await cookies();
 const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value ?? null;
 const username = cookieStore.get(SESSION_USERNAME_COOKIE)?.value ?? null;
 const instance = (await headers()).get("host") ??"";
 // JWT 只存在 HttpOnly cookie 里，不下发给客户端；客户端靠 cookie 鉴权
 const initialSession: Session | null = token && username ? { username, instance } : null;

 // 语言：cookie 里读，默认中文
 const rawLocale = cookieStore.get(LOCALE_COOKIE)?.value;
 const initialLocale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

 return (
 // suppressHydrationWarning：data-theme / --accent-hue 由首屏脚本改写在 <html> 上，
 // 与服务端输出必然不同，这是预期行为。
 <html lang={HTML_LANG[initialLocale]} suppressHydrationWarning>
 <head>
 {/* 阻塞式首屏主题注入：避免深色用户在 React 水合前看到白屏闪烁 */}
 <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
 </head>
 <body>
 <AppShell initialSession={initialSession} initialLocale={initialLocale}>{children}</AppShell>
 </body>
 </html>
 );
}
