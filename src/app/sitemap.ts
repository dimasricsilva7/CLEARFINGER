import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...["politica-de-privacidade", "termos", "trocas-e-devolucoes", "cookies"].map((s) => ({ url: `${base}/${s}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
