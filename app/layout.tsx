import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
    title: "LightAP · 轻量 ActivityPub 社区",
    description: "一个可爱的去中心化联邦宇宙小站，基于 ActivityPub 协议。",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "#dbeafe",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="zh-CN">
            <body>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
