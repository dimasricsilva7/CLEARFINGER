import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export type SectionData = {
  id: string;
  key: string;
  type: string;
  label: string;
  sortOrder: number;
  active: boolean;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  config: Record<string, unknown>;
};

const toSection = (r: Awaited<ReturnType<typeof db.landingSection.findMany>>[number]): SectionData => ({
  ...r,
  config: (r.config && typeof r.config === "object" ? r.config : {}) as Record<string, unknown>,
});

export const loadLandingSectionsDirect = async () => (await db.landingSection.findMany({ orderBy: { sortOrder: "asc" } })).map(toSection);

export const getLandingSections = unstable_cache(
  async (): Promise<SectionData[]> => {
    const rows = await loadLandingSectionsDirect();
    if (!rows.length) throw new Error("landing vazia"); // nunca guarda vazio no cache
    return rows;
  },
  ["cf-landing-sections-v1"],
  { tags: ["landing"], revalidate: 300 }
);

export const loadFaqsDirect = () => db.faq.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
export const getFaqs = unstable_cache(loadFaqsDirect, ["cf-faqs-v1"], { tags: ["faq"], revalidate: 300 });

/** Somente depoimentos reais, ativos (o admin confirma a autorização ao publicar). */
export const loadTestimonialsDirect = () => db.testimonial.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 24 });
export const getTestimonials = unstable_cache(loadTestimonialsDirect, ["cf-testimonials-v1"], { tags: ["testimonials"], revalidate: 300 });

export const cfgStr = (c: Record<string, unknown>, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
export const cfgArr = <T,>(c: Record<string, unknown>, k: string): T[] => (Array.isArray(c[k]) ? (c[k] as T[]) : []);

/**
 * Leitura resiliente: tenta o cache; se falhar (banco acordando), tenta de novo direto no banco;
 * se ainda falhar, devolve o valor padrão SEM guardar no cache.
 */
export async function safeLoad<T>(cached: () => Promise<T>, direct: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cached();
  } catch {
    try {
      return await direct();
    } catch {
      return fallback;
    }
  }
}
