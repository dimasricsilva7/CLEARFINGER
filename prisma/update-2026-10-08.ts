/**
 * Atualização de conteúdo 08/10/2026 (idempotente — só altera o que ainda está no valor antigo):
 * - imagem do produto recortada (sem fundo) para combinar com a paleta;
 * - foto na seção de dor;
 * - 2 order bumps iniciais (editáveis em Admin → Order bumps).
 *   DATABASE_URL=... npx tsx prisma/update-2026-10-08.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const OLD = "/brand/kit.webp";
const NEW = "/brand/kit-cutout.webp";

async function main() {
  const r1 = await db.productImage.updateMany({ where: { url: OLD }, data: { url: NEW } });
  const r2 = await db.landingSection.updateMany({ where: { imageUrl: OLD }, data: { imageUrl: null } }); // seções usam a imagem principal
  const pain = await db.landingSection.updateMany({ where: { type: "pain", imageUrl: null }, data: { imageUrl: "/brand/smoker.webp" } });
  await db.mediaAsset.upsert({ where: { id: "brand_kit_cutout" }, update: {}, create: { id: "brand_kit_cutout", name: "Kit CLEARFINGER (sem fundo)", url: NEW, category: "PRODUTO", alt: "Caixa e frasco do CLEARFINGER, 30 mL", storage: "static" } });
  await db.mediaAsset.upsert({ where: { id: "stock_smoker" }, update: {}, create: { id: "stock_smoker", name: "Homem acendendo cigarro (Unsplash — Donny Jiang)", url: "/brand/smoker.webp", category: "HERO", alt: "Mãos acendendo um cigarro", storage: "static" } });

  let bumps = 0;
  if ((await db.orderBump.count()) === 0) {
    const product = await db.product.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
    if (product) {
      await db.orderBump.createMany({
        data: [
          { productId: product.id, name: "+1 frasco", title: "Adicione +1 frasco com desconto", description: "Um frasco extra para deixar no trabalho ou na bolsa. Oferta exclusiva deste pedido.", quantity: 1, priceCents: 3990, compareAtPriceCents: 5990, badge: "Oferta do checkout", sortOrder: 1 },
          { productId: product.id, name: "+2 frascos", title: "Leve +2 frascos e não fique sem", description: "Dois frascos extras com preço especial para usar por mais tempo.", quantity: 2, priceCents: 6990, compareAtPriceCents: 11980, badge: "Melhor preço", sortOrder: 2 },
        ],
      });
      bumps = 2;
    }
  }
  console.log({ productImages: r1.count, sectionsCleared: r2.count, painImage: pain.count, bumps });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
