/** Rotinas de manutenção (sem "server-only" para poderem rodar via tsx). */
import type { db as Db } from "@/lib/db";
import { decodeEnvHash } from "@/lib/auth/hash";

/** Define a senha do administrador ADMIN_EMAIL a partir de ADMIN_PASSWORD_HASH (recuperação de acesso). */
export async function resetAdminFromEnv(target: typeof Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = decodeEnvHash(process.env.ADMIN_PASSWORD_HASH);
  if (!email || !hash) throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD_HASH ausentes");
  const admin = await target.adminUser.upsert({
    where: { email },
    update: { passwordHash: hash, active: true, role: "OWNER" },
    create: { email, name: "Administrador", passwordHash: hash, role: "OWNER" },
  });
  await target.adminSession.deleteMany({ where: { adminId: admin.id } });
  await target.loginAttempt.deleteMany({ where: { key: `email:${email}` } });
  await target.auditLog.create({ data: { action: "admin_password_reset", entity: "adminUser", entityId: admin.id, summary: `Senha de ${email} redefinida via variável de ambiente` } });
  return { email, reset: true };
}

type AnyDelegate = { createMany: (a: object) => Promise<{ count: number }>; count: () => Promise<number> };

/** Ordem respeita as chaves estrangeiras. Sessões admin, tentativas de login e travas não são copiadas. */
const MODELS = [
  "adminUser",
  "auditLog",
  "product",
  "productImage",
  "productOffer",
  "priceHistory",
  "orderBump",
  "mediaAsset",
  "customer",
  "order",
  "orderItem",
  "payment",
  "paymentEvent",
  "crediarioData",
  "utmData",
  "webhookEvent",
  "visitorSession",
  "trackingEvent",
  "landingSection",
  "testimonial",
  "faq",
  "siteSettings",
] as const;

const stripNulls = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

/**
 * Copia todos os dados de LEGACY_DATABASE_URL (banco antigo) para o banco atual (DATABASE_URL).
 * Só roda se o banco atual não tiver pedidos nem produtos, a menos que force=true. Idempotente (skipDuplicates).
 */
export async function migrateFromLegacy(target: typeof Db, legacyUrl: string | undefined, force = false) {
  if (!legacyUrl) throw new Error("LEGACY_DATABASE_URL não configurada");
  const { PrismaClient } = await import("@prisma/client");
  const already = (await target.product.count()) + (await target.order.count());
  if (already > 0 && !force) return { skipped: true, reason: `banco atual já tem ${already} produtos/pedidos` };
  const legacy = new PrismaClient({ datasourceUrl: legacyUrl });
  const copied: Record<string, number> = {};
  try {
    for (const model of MODELS) {
      const dst = (target as unknown as Record<string, AnyDelegate>)[model];
      const table = model.charAt(0).toUpperCase() + model.slice(1);
      const rows = await legacy.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${table}"`);
      let count = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const res = await dst.createMany({ data: rows.slice(i, i + 200).map(stripNulls), skipDuplicates: true });
        count += res.count;
      }
      copied[model] = count;
    }
    await target.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Order"', 'seq'), GREATEST(COALESCE((SELECT MAX(seq) FROM "Order"), 1), 1))`);
  } finally {
    await legacy.$disconnect();
  }
  return { skipped: false, copied };
}
