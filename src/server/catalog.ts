import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { IconItem, ProductSpec } from "@/lib/domain";
import type { PublicBump, PublicImage, PublicOffer, PublicProduct } from "@/types/catalog";

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

async function loadMainProduct() {
  // O produto principal é o ativo com kits e menor ordem (os complementares entram como order bump / upsell)
  return db.product.findFirst({
    where: { active: true, offers: { some: { active: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { images: { orderBy: [{ role: "asc" }, { sortOrder: "asc" }] }, offers: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}
type ProductRow = NonNullable<Awaited<ReturnType<typeof loadMainProduct>>>;

export function toPublicOffer(o: ProductRow["offers"][number]): PublicOffer {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    quantity: o.quantity,
    priceCents: o.priceCents,
    compareAtPriceCents: o.compareAtPriceCents && o.compareAtPriceCents > o.priceCents ? o.compareAtPriceCents : null,
    discountLabel: o.discountLabel,
    badge: o.badge,
    highlight: o.highlight,
    description: o.description,
    imageUrl: o.imageUrl,
    unitPriceCents: Math.round(o.priceCents / Math.max(1, o.quantity)),
  };
}

export function toPublicProduct(p: ProductRow): PublicProduct {
  const img = (i: ProductRow["images"][number]): PublicImage => ({ url: i.url, alt: i.alt || p.name, role: i.role });
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    shortName: p.shortName,
    shortDescription: p.shortDescription,
    description: p.description,
    priceCents: p.priceCents,
    compareAtPriceCents: p.compareAtPriceCents,
    badge: p.badge,
    videoUrl: p.videoUrl,
    benefits: asArray<IconItem>(p.benefits).filter((b) => b?.title),
    specs: asArray<ProductSpec>(p.specs).filter((s) => s?.label && s?.value),
    mainImage: p.images.find((i) => i.role === "MAIN") ? img(p.images.find((i) => i.role === "MAIN")!) : p.images[0] ? img(p.images[0]) : null,
    secondaryImage: p.images.find((i) => i.role === "SECONDARY") ? img(p.images.find((i) => i.role === "SECONDARY")!) : null,
    gallery: p.images.filter((i) => i.role === "GALLERY").map(img),
    offers: p.offers.filter((o) => o.priceCents > 0).map(toPublicOffer),
  };
}

const cachedProduct = unstable_cache(
  async () => {
    const p = await loadMainProduct(); // erro do banco lança: nunca vai para o cache
    return p ? toPublicProduct(p) : null;
  },
  ["cf-main-product-v1"],
  { tags: ["catalog"], revalidate: 300 }
);

/** Produto principal + ofertas ativas (cache invalidado pela tag "catalog"). Falha do banco → leitura direta. */
export async function getMainProduct(): Promise<PublicProduct | null> {
  try {
    return await cachedProduct();
  } catch {
    const p = await loadMainProduct().catch(() => null);
    return p ? toPublicProduct(p) : null;
  }
}

/** Oferta vendável (ativa, com preço e produto ativo) — leitura sem cache, usada no checkout. */
export async function findSellableOffer(idOrSlug: string) {
  const offer = await db.productOffer.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: { product: true } });
  if (!offer || !offer.active || offer.priceCents <= 0 || !offer.product.active) return null;
  if (offer.product.stockQuantity != null && offer.product.stockQuantity < offer.quantity) return null;
  return offer;
}

/** Order bumps ativos (leitura sem cache: o checkout sempre mostra o preço atual). */
export async function getActiveBumps(): Promise<PublicBump[]> {
  const rows = await db.orderBump.findMany({ where: { active: true, product: { active: true } }, include: { product: { include: { images: { where: { role: "MAIN" }, take: 1 } } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows
    .filter((b) => b.priceCents > 0)
    .map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      quantity: b.quantity,
      priceCents: b.priceCents,
      compareAtPriceCents: b.compareAtPriceCents && b.compareAtPriceCents > b.priceCents ? b.compareAtPriceCents : null,
      imageUrl: b.imageUrl || b.product.images[0]?.url || null,
      imageCount: b.imageUrl ? 1 : b.quantity,
      badge: b.badge,
      productName: b.product.name,
    }));
}
