import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniAP · Outbox 测试",
  description: "MiniAP ActivityPub outbox 测试页面",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
