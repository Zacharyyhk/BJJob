import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "京职搜｜招聘信息聚合",
  description: "聚合北京机关单位及全国互联网大厂、央企国企招聘信息。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "京职搜｜招聘信息聚合",
    description: "一处查看北京机关单位及全国大厂、国企招聘。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "京职搜" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
