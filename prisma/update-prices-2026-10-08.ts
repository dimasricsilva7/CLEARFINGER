/**
 * Novos preços dos kits (pedido do proprietário, 08/10/2026), com registro em PriceHistory.
 *   DATABASE_URL=... npx tsx prisma/update-prices-2026-10-08.ts
 * Preço "de" = preço unitário × quantidade (referência de 1 unidade a R$ 39,90).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PRICES = [
  { slug: "kit-1", name: "1 unidade", priceCents: 3990, compareAtPriceCents: null, badge: null, highlight: false },
  { slug: "kit-2", name: "2 unidades", priceCents: 5990, compareAtPriceCents: 7980, badge: "Mais vendido", highlight: true },
  { slug: "kit-3", name: "3 unidades", priceCents: 8990, compareAtPriceCents: 11970, badge: "Tratamento completo", highlight: false },
];

async function main() {
  for (const p of PRICES) {
    const before = await db.productOffer.findUnique({ where: { slug: p.slug } });
    if (!before) {
      console.log("oferta não encontrada:", p.slug);
      continue;
    }
    await db.productOffer.update({ where: { id: before.id }, data: { name: p.name, priceCents: p.priceCents, compareAtPriceCents: p.compareAtPriceCents, badge: p.badge, highlight: p.highlight, discountLabel: null } });
    if (before.priceCents !== p.priceCents) await db.priceHistory.create({ data: { offerId: before.id, oldPriceCents: before.priceCents, newPriceCents: p.priceCents } });
    console.log(p.slug, before.priceCents, "→", p.priceCents);
  }
  await db.product.updateMany({ where: { sku: { not: "" }, priceCents: 5990 }, data: { priceCents: 3990, compareAtPriceCents: null } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
