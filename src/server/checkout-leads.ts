import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { log } from "@/lib/log";
import { parseUserAgent } from "@/utils/channel";
import { findSellableOffer } from "@/server/catalog";
import { getSettingsFresh, isOn, settingInt, shippingCentsFrom } from "@/server/settings";
import { formatBRL } from "@/utils/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const checkoutLeadSchema = z.object({
  clientKey: z.string().min(16).max(64),
  name: z.string().max(120).optional(),
  email: z.string().max(160).optional(),
  phone: z.string().max(30).optional(),
  offerId: z.string().max(60),
  bumpIds: z.array(z.string().max(40)).max(5).optional(),
  paymentMethod: z.enum(["PIX", "CREDIARIO"]).optional(),
  sessionId: z.string().max(80).optional(),
  visitorId: z.string().max(80).optional(),
  utmSource: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
});
export type CheckoutLeadInput = z.infer<typeof checkoutLeadSchema>;

/**
 * Registra/atualiza o checkout em andamento. Só grava com contato útil (e-mail válido ou WhatsApp com DDD).
 * Agenda o e-mail de checkout abandonado (padrão 30 min após a última atividade). Nunca grava CPF nem dados do crediário.
 */
export async function upsertCheckoutLead(input: CheckoutLeadInput, meta: { userAgent: string | null }) {
  const email = input.email && EMAIL_RE.test(input.email.trim()) ? input.email.trim().toLowerCase() : null;
  const phone = (input.phone ?? "").replace(/\D/g, "");
  const name = input.name?.trim() || null;
  if (!email && phone.length < 10) return null;

  const existing = await db.checkoutLead.findUnique({ where: { clientKey: input.clientKey } });
  if (existing?.orderId) return existing; // já virou pedido

  // Resumo e total calculados no servidor (preço real da oferta e dos bumps)
  const offer = await findSellableOffer(input.offerId);
  const bumpIds = [...new Set(input.bumpIds ?? [])];
  const bumps = bumpIds.length ? await db.orderBump.findMany({ where: { id: { in: bumpIds }, active: true } }) : [];
  const s = await getSettingsFresh();
  const lines = [offer ? `${offer.product.name} — ${offer.name} (${formatBRL(offer.priceCents)})` : null, ...bumps.map((b) => `${b.title} (${formatBRL(b.priceCents)})`)].filter(Boolean) as string[];
  const totalCents = (offer?.priceCents ?? 0) + bumps.reduce((a, b) => a + b.priceCents, 0) + (offer ? shippingCentsFrom(s) : 0);

  const delay = Math.max(1, settingInt(s, "email_checkout_delay_minutes", 30));
  // Reagenda enquanto a pessoa ainda está preenchendo (conta a partir da última atividade)
  const schedule =
    email && isOn(s.email_checkout_enabled) && (!existing || existing.emailStatus === null || existing.emailStatus === "SCHEDULED")
      ? { emailStatus: "SCHEDULED" as const, emailScheduledFor: new Date(Date.now() + delay * 60_000) }
      : {};

  const data = {
    name,
    email,
    phone: phone || null,
    offerId: offer?.id ?? null,
    bumpIds: bumps.map((b) => b.id) as Prisma.InputJsonValue,
    itemsSummary: lines.join(" + ").slice(0, 600),
    totalCents,
    paymentMethod: input.paymentMethod ?? null,
    ...schedule,
  };
  if (existing) return db.checkoutLead.update({ where: { id: existing.id }, data });
  return db.checkoutLead
    .create({
      data: {
        ...data,
        clientKey: input.clientKey,
        token: randomToken(24),
        sessionId: input.sessionId ?? null,
        visitorId: input.visitorId ?? null,
        utmSource: input.utmSource ?? null,
        utmCampaign: input.utmCampaign ?? null,
        device: parseUserAgent(meta.userAgent).device,
      },
    })
    .catch(async (e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return db.checkoutLead.findUnique({ where: { clientKey: input.clientKey } });
      throw e;
    });
}

/** Pedido criado → o checkout converteu: cancela o e-mail de checkout abandonado. */
export async function linkLeadToOrder(leadKey: string | null | undefined, orderId: string, email: string) {
  if (leadKey) {
    const lead = await db.checkoutLead.findUnique({ where: { clientKey: leadKey } }).catch(() => null);
    if (lead && !lead.orderId)
      await db.checkoutLead
        .update({ where: { id: lead.id }, data: { orderId, email, ...(lead.emailStatus === "SCHEDULED" ? { emailStatus: "CANCELLED", emailError: "Virou pedido" } : {}) } })
        .catch(() => null);
  }
  // Outros checkouts abertos do mesmo e-mail também não precisam do lembrete
  await db.checkoutLead.updateMany({ where: { email: email.toLowerCase(), orderId: null, emailStatus: "SCHEDULED" }, data: { emailStatus: "CANCELLED", emailError: "Cliente gerou um pedido" } }).catch(() => null);
}

/** Restaura oferta + contato a partir do link do e-mail. */
export async function findLeadByToken(token: string | null | undefined) {
  if (!token || token.length < 16 || token.length > 64) return null;
  return db.checkoutLead.findUnique({ where: { token } });
}

export function logLeadError(message: string, err: unknown) {
  log.error("checkout-lead", message, { error: err instanceof Error ? err.message : String(err) });
}
