/**
 * Atualização de conteúdo 08/10/2026 — evolução (idempotente: só altera o que ainda está no valor antigo).
 * - foto oficial opaca do produto (kit-photo.webp) no lugar do recorte transparente;
 * - imagens dos 3 passos do "Como usar" (só nos passos ainda sem imagem);
 * - produtos complementares CLEARFINGER HAND CARE e CLEARFINGER ODOR CONTROL — INATIVOS, sem imagem
 *   e com preço provisório: o proprietário define foto, preço e ativa no admin;
 * - order bumps e upsell desses produtos, também inativos.
 *   DATABASE_URL=... npx tsx prisma/update-2026-10-08b.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PHOTO = "/brand/kit-photo.webp";
const STEP_IMAGES = ["/brand/step-1.webp", "/brand/step-2.webp", "/brand/step-3.webp"];

const COMPLEMENTARY = [
  {
    slug: "clearfinger-hand-care",
    sku: "CF-HANDCARE",
    name: "CLEARFINGER HAND CARE",
    shortName: "Hand Care",
    subtitle: "Creme para cuidado das mãos",
    shortDescription: "Creme para cuidado das mãos após exposição ao odor do cigarro.",
    description: "Creme para cuidado das mãos após exposição ao odor do cigarro.",
    ctaLabel: "Adicionar ao pedido",
    sortOrder: 10,
  },
  {
    slug: "clearfinger-odor-control",
    sku: "CF-ODORCONTROL",
    name: "CLEARFINGER ODOR CONTROL",
    shortName: "Odor Control",
    subtitle: "Neutralizador de Odores para Tecidos, Carro e Ambientes",
    shortDescription: "Neutralizador de odores para tecidos, carro e ambientes.",
    description: "Neutralizador de Odores para Tecidos, Carro e Ambientes.",
    ctaLabel: "Adicionar ao pedido",
    sortOrder: 20,
  },
];
const PLACEHOLDER_PRICE = 2990; // provisório — o produto fica inativo até o proprietário definir o preço real

async function main() {
  // 1) Foto oficial opaca
  const photo = await db.productImage.updateMany({ where: { url: { in: ["/brand/kit-cutout.webp", "/brand/kit.webp"] } }, data: { url: PHOTO } });
  await db.mediaAsset.updateMany({ where: { url: "/brand/kit-cutout.webp" }, data: { url: PHOTO, name: "Kit CLEARFINGER (foto oficial)" } });
  await db.mediaAsset.upsert({ where: { id: "brand_kit_photo" }, update: {}, create: { id: "brand_kit_photo", name: "Kit CLEARFINGER (foto oficial)", url: PHOTO, category: "PRODUTO", alt: "Caixa e frasco do CLEARFINGER, 30 mL", storage: "static" } });
  const steps = [
    ["stock_step_1", "Como usar — passo 1: aplicação (Unsplash)", STEP_IMAGES[0], "Aplicação do produto nas mãos"],
    ["stock_step_2", "Como usar — passo 2: limpeza (Unsplash)", STEP_IMAGES[1], "Lavando as mãos"],
    ["stock_step_3", "Como usar — passo 3: mãos limpas (Unsplash)", STEP_IMAGES[2], "Mãos com aparência limpa"],
  ];
  for (const [id, name, url, alt] of steps) await db.mediaAsset.upsert({ where: { id }, update: {}, create: { id, name, url, category: "DEMONSTRACAO", alt, storage: "static" } });

  // 2) Imagens dos passos
  let stepImages = 0;
  for (const sec of await db.landingSection.findMany({ where: { type: "how_it_works" } })) {
    const cfg = (sec.config ?? {}) as Record<string, unknown>;
    const list = Array.isArray(cfg.steps) ? (cfg.steps as Record<string, unknown>[]) : [];
    let changed = false;
    const next = list.map((s, i) => {
      if (!s.imageUrl && STEP_IMAGES[i]) {
        changed = true;
        stepImages++;
        return { ...s, imageUrl: STEP_IMAGES[i] };
      }
      return s;
    });
    if (typeof cfg.note === "string" && !/ilustrativ/i.test(cfg.note)) {
      cfg.note = `Imagens ilustrativas. ${cfg.note}`;
      changed = true;
    }
    if (changed) await db.landingSection.update({ where: { id: sec.id }, data: { config: { ...cfg, steps: next } as Prisma.InputJsonValue } });
  }

  // 3) Produtos complementares (inativos)
  const created: string[] = [];
  for (const p of COMPLEMENTARY) {
    const exists = await db.product.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    await db.product.create({ data: { ...p, priceCents: PLACEHOLDER_PRICE, active: false, featured: false, badge: null } });
    created.push(p.name);
  }
  const hand = await db.product.findUnique({ where: { slug: "clearfinger-hand-care" } });
  const odor = await db.product.findUnique({ where: { slug: "clearfinger-odor-control" } });

  // 4) Order bumps e upsell desses produtos (inativos até o produto ter foto e preço)
  let bumps = 0;
  for (const [prod, title, desc, order] of [
    [hand, "Adicione o CLEARFINGER HAND CARE", "Creme para cuidado das mãos após exposição ao odor do cigarro.", 10],
    [odor, "Adicione o CLEARFINGER ODOR CONTROL", "Neutralizador de odores para tecidos, carro e ambientes.", 11],
  ] as const) {
    if (!prod || (await db.orderBump.count({ where: { productId: prod.id } }))) continue;
    await db.orderBump.create({ data: { productId: prod.id, name: prod.shortName ?? prod.name, title, description: desc, quantity: 1, priceCents: PLACEHOLDER_PRICE, sortOrder: order, active: false } });
    bumps++;
  }
  let upsells = 0;
  if (odor && !(await db.upsell.count({ where: { productId: odor.id } }))) {
    await db.upsell.create({
      data: {
        productId: odor.id,
        name: "Odor Control pós-compra",
        title: "Leve também o CLEARFINGER ODOR CONTROL",
        description: "Neutralizador de odores para tecidos, carro e ambientes. Pagamento separado via PIX, enviado junto com o seu pedido.",
        quantity: 1,
        priceCents: PLACEHOLDER_PRICE,
        trigger: "ANY_CONFIRMED",
        position: "TOP",
        active: false,
      },
    });
    upsells++;
  }
  console.log({ productPhoto: photo.count, stepImages, productsCreated: created, bumps, upsells });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
