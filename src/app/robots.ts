import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/server/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  if (s.robots_index === "false") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/pedido"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
