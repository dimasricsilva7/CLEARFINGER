import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import { siteUrl } from "@/lib/env";
import { themeCss } from "@/lib/theme";
import { getSettings } from "@/server/settings";
import "./globals.css";

const display = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"], display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700", "800"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.seo_title || s.store_name;
  const description = s.seo_description;
  const images = s.og_image_url ? [s.og_image_url] : [];
  const index = s.robots_index !== "false";
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s | ${s.store_name}` },
    description,
    applicationName: s.store_name,
    alternates: { canonical: s.canonical_url || "/" },
    openGraph: { type: "website", locale: "pt_BR", siteName: s.store_name, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
    icons: { icon: s.favicon_url || "/brand/favicon.png", apple: "/brand/apple-icon.png" },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B2545", viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const css = themeCss(settings);
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable}`}>
      <head>{css && <style id="theme-tokens">{css}</style>}</head>
      <body>{children}</body>
    </html>
  );
}
