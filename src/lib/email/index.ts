import "server-only";
import type { EmailType } from "@prisma/client";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { log } from "@/lib/log";
import { trackServerEvent } from "@/lib/analytics";
import { deliver, emailProvider } from "@/lib/email/provider";
import { isAwaitingPix, isPaidStatus, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { formatCep, formatPhone } from "@/utils/format";
import { getSettingsFresh, isOn, settingInt, type Settings } from "@/server/settings";
import { checkoutRecoveryEmail, pixRecoveryEmail, purchaseConfirmationEmail, type EmailBrand, type EmailOrder, type EmailTexts } from "@/emails/templates";

export const EMAIL_TYPE_LABEL: Record<EmailType, string> = {
  PURCHASE_CONFIRMATION: "Confirmação de compra",
  PIX_RECOVERY: "PIX pendente (lembrete)",
};

export const EMAIL_STATUS_LABEL = { SCHEDULED: "Agendado", SENDING: "Enviando", SENT: "Enviado", FAILED: "Falhou", CANCELLED: "Cancelado", SKIPPED: "Não enviado" } as const;

async function loadOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: { customer: true, items: true, crediario: { select: { installmentLabel: true, methodLabel: true } } } });
}
type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

const abs = (url: string) => (url.startsWith("http") ? url : `${siteUrl()}${url}`);

export function brandFromSettings(s: Settings): EmailBrand {
  const base = siteUrl();
  const digits = (s.whatsapp ?? "").replace(/\D/g, "");
  return {
    store: s.store_name || "CLEARFINGER",
    tagline: s.store_tagline || "",
    // Clientes de e-mail não exibem WebP/SVG: logo e foto em PNG/JPG próprios para e-mail
    logoUrl: s.email_logo_url ? abs(s.email_logo_url) : `${base}/email/logo.png`,
    productImageUrl: s.email_product_image_url ? abs(s.email_product_image_url) : `${base}/email/kit.jpg`,
    siteUrl: base,
    primary: s.theme_primary || "#1F6FD1",
    navy: s.theme_navy || "#0B2545",
    background: s.theme_background || "#F5F8FC",
    whatsappUrl: digits.length >= 10 ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}` : null,
    whatsappLabel: digits.length >= 10 ? formatPhone(digits) : null,
    contactEmail: s.contact_email || null,
    companyLine: [s.company_name, s.company_document ? `CNPJ ${s.company_document}` : ""].filter(Boolean).join(" · ") || null,
    shippingLabel: isOn(s.shipping_free_enabled) ? s.shipping_label || null : null,
    shippingEta: s.shipping_eta || null,
  };
}

const texts = (s: Settings, prefix: "confirmation" | "recovery" | "checkout"): EmailTexts => ({
  subject: s[`email_${prefix}_subject`] ?? "",
  title: s[`email_${prefix}_title`] ?? "",
  text: s[`email_${prefix}_text`] ?? "",
  button: s[`email_${prefix}_button`] || "Abrir",
});

export function toEmailOrder(o: LoadedOrder): EmailOrder {
  const a = o.shippingAddress as { street?: string; number?: string; complement?: string | null; district?: string; city?: string; state?: string; cep?: string } | null;
  return {
    orderNumber: o.orderNumber ?? o.id,
    firstName: o.customer.name.split(/\s+/)[0],
    paymentLabel: o.paymentMethod === "CREDIARIO" ? `${o.crediario?.methodLabel ?? PAYMENT_METHOD_LABEL.CREDIARIO}${o.crediario?.installmentLabel ? ` · ${o.crediario.installmentLabel}` : ""}` : "PIX",
    items: o.items.map((i) => ({
      name: i.kind === "OFFER" ? i.productName : i.offerName,
      detail: i.kind === "OFFER" ? `${i.offerName}${i.quantity > 1 ? ` × ${i.quantity}` : ""}` : i.kind === "UPSELL" ? "Oferta adicional" : "Adicionado ao pedido",
      quantity: i.quantity,
      totalCents: i.totalPriceCents,
      kind: i.kind,
    })),
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    pixCopyPaste: o.pixCopyPaste,
    pixExpiresAt: o.pixExpiresAt,
    pixExpired: o.status === "EXPIRED" || o.status === "FAILED" || !o.pixCopyPaste || (!!o.pixExpiresAt && o.pixExpiresAt < new Date()),
    address: a?.street ? `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""} · ${a.district} · ${a.city}/${a.state} · CEP ${formatCep(a.cep ?? "")}` : null,
  };
}

export const orderUrl = (o: { orderNumber: string | null; accessToken: string }) => `${siteUrl()}/pedido/${encodeURIComponent(o.orderNumber ?? "")}?t=${encodeURIComponent(o.accessToken)}`;
export const trackUrl = (o: { orderNumber: string | null }) => `${siteUrl()}/rastrear-pedido?pedido=${encodeURIComponent(o.orderNumber ?? "")}`;
/** Descadastro dos lembretes (link no rodapé + List-Unsubscribe one-click, RFC 8058). */
export const unsubscribeUrl = (o: { orderNumber: string | null; accessToken: string }) =>
  `${siteUrl()}/api/email/unsubscribe?pedido=${encodeURIComponent(o.orderNumber ?? "")}&t=${encodeURIComponent(o.accessToken)}`;
export const leadRecoveryUrl = (token: string) => `${siteUrl()}/checkout?recuperar=${encodeURIComponent(token)}`;
export const leadUnsubscribeUrl = (token: string) => `${siteUrl()}/api/email/unsubscribe?lead=${encodeURIComponent(token)}`;
const unsubHeaders = (url: string) => ({ "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

export function renderEmail(type: EmailType, o: LoadedOrder, s: Settings) {
  const b = brandFromSettings(s);
  const data = toEmailOrder(o);
  if (type === "PIX_RECOVERY") {
    const unsub = unsubscribeUrl(o);
    return { ...pixRecoveryEmail(b, data, orderUrl(o), unsub, texts(s, "recovery")), headers: unsubHeaders(unsub) };
  }
  return { ...purchaseConfirmationEmail(b, data, orderUrl(o), trackUrl(o), texts(s, "confirmation")), headers: undefined };
}

/** O e-mail ainda faz sentido no momento do envio? (ex.: não lembrar de PIX já pago) */
function eligibility(type: EmailType, o: LoadedOrder, manual: boolean): string | null {
  if (type === "PIX_RECOVERY") {
    if (o.paymentMethod !== "PIX") return "Pedido não é PIX";
    if (!manual && o.customer.emailOptOutAt) return "Cliente descadastrou dos lembretes";
    // Reenvio manual vale para PIX vencido: o e-mail leva ao pedido, que gera um código novo
    const renewable = o.status === "EXPIRED" || o.status === "FAILED";
    if (!isAwaitingPix(o.status) && !(manual && renewable)) return `Pedido não está aguardando pagamento (${o.status})`;
    if (!manual && !o.pixCopyPaste) return "PIX não foi gerado";
  }
  if (type === "PURCHASE_CONFIRMATION" && !isPaidStatus(o.status)) return "Pedido não está pago/aprovado";
  return null;
}

async function scheduleEmail(orderId: string, type: EmailType, toEmail: string, delayMinutes: number) {
  const existing = await db.emailEvent.findFirst({ where: { orderId, type, triggeredBy: "system", status: { in: ["SCHEDULED", "SENDING", "SENT"] } } });
  if (existing) return existing; // um envio automático por tipo/pedido
  return db.emailEvent.create({ data: { orderId, type, toEmail, scheduledFor: new Date(Date.now() + delayMinutes * 60_000) } });
}

export async function cancelScheduled(orderId: string, type: EmailType, reason: string) {
  await db.emailEvent.updateMany({ where: { orderId, type, status: "SCHEDULED" }, data: { status: "CANCELLED", error: reason } });
}

/** Envia um EmailEvent (reserva atômica: nunca envia duas vezes o mesmo registro). */
export async function sendEmailEvent(id: string, opts: { manual?: boolean } = {}) {
  const claimed = await db.emailEvent.updateMany({ where: { id, status: { in: ["SCHEDULED", "FAILED"] } }, data: { status: "SENDING", attempts: { increment: 1 } } });
  if (!claimed.count) return { ok: false as const, error: "E-mail já processado" };
  const ev = await db.emailEvent.findUniqueOrThrow({ where: { id } });
  const order = await loadOrder(ev.orderId);
  if (!order) {
    await db.emailEvent.update({ where: { id }, data: { status: "SKIPPED", error: "Pedido não encontrado" } });
    return { ok: false as const, error: "Pedido não encontrado" };
  }
  const reason = eligibility(ev.type, order, Boolean(opts.manual));
  if (reason) {
    await db.emailEvent.update({ where: { id }, data: { status: "SKIPPED", error: reason } });
    return { ok: false as const, error: reason };
  }
  const s = await getSettingsFresh();
  const { subject, html, text, headers } = renderEmail(ev.type, order, s);
  const result = await deliver({ to: ev.toEmail, subject, html, text, headers, idempotencyKey: `cf-email-${ev.id}` }, s.contact_email || null);
  if (result.ok) {
    await db.emailEvent.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), subject, providerMessageId: result.id, error: null } });
    await trackServerEvent(order, ev.type === "PIX_RECOVERY" ? "email_recovery_sent" : "email_confirmation_sent").catch(() => null);
    log.info("email", "enviado", { type: ev.type, order: order.orderNumber });
    return { ok: true as const };
  }
  const giveUp = Boolean(opts.manual) || !result.retryable || ev.attempts >= 3;
  await db.emailEvent.update({ where: { id }, data: { status: giveUp ? "FAILED" : "SCHEDULED", error: result.error, subject, scheduledFor: new Date(Date.now() + 5 * 60_000) } });
  log.error("email", "falha no envio", { type: ev.type, order: order.orderNumber, error: result.error });
  return { ok: false as const, error: result.error };
}

/** Pagamento confirmado / crediário aprovado → confirmação imediata (e cancela o lembrete de PIX). */
export async function onOrderPaidEmail(orderId: string, email: string) {
  await cancelScheduled(orderId, "PIX_RECOVERY", "Pedido pago");
  const s = await getSettingsFresh();
  if (!isOn(s.email_confirmation_enabled)) return;
  const ev = await scheduleEmail(orderId, "PURCHASE_CONFIRMATION", email, 0);
  if (ev.status === "SCHEDULED" && emailProvider() !== "none") await sendEmailEvent(ev.id).catch(() => null);
}

/** PIX gerado → agenda o lembrete (padrão 10 min). Cancelado automaticamente se o pedido for pago. */
export async function onPixGeneratedEmail(orderId: string, email: string) {
  const s = await getSettingsFresh();
  if (!isOn(s.email_recovery_enabled)) return;
  await scheduleEmail(orderId, "PIX_RECOVERY", email, Math.max(1, settingInt(s, "email_recovery_delay_minutes", 10)));
}

/** Reenvio manual pelo admin (anti-spam: 2 min entre envios do mesmo tipo). */
export async function resendEmail(orderId: string, type: EmailType, adminId: string) {
  const recent = await db.emailEvent.findFirst({ where: { orderId, type, status: { in: ["SENT", "SENDING"] }, updatedAt: { gte: new Date(Date.now() - 2 * 60_000) } } });
  if (recent) return { ok: false as const, error: "Este e-mail foi enviado há menos de 2 minutos. Aguarde para reenviar." };
  if (emailProvider() === "none") return { ok: false as const, error: "E-mail não configurado: defina RESEND_API_KEY e EMAIL_FROM na Vercel." };
  const order = await loadOrder(orderId);
  if (!order) return { ok: false as const, error: "Pedido não encontrado" };
  const ev = await db.emailEvent.create({ data: { orderId, type, toEmail: order.customer.email, triggeredBy: `admin:${adminId}` } });
  return sendEmailEvent(ev.id, { manual: true });
}

/** Processa e-mails agendados vencidos (cron/tick e execução oportunista). */
export async function processDueEmails(limit = 25) {
  if (emailProvider() === "none") return { disabled: true as const };
  await db.emailEvent.updateMany({ where: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { status: "SCHEDULED" } });
  const due = await db.emailEvent.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } }, orderBy: { scheduledFor: "asc" }, take: limit, select: { id: true } });
  let sent = 0;
  for (const e of due) if ((await sendEmailEvent(e.id)).ok) sent++;
  const leads = await processDueLeadEmails(limit);
  return { processed: due.length, sent, leads };
}

// ───────────── Checkout abandonado (lead sem pedido) ─────────────

type Lead = NonNullable<Awaited<ReturnType<typeof db.checkoutLead.findUnique>>>;

export function renderLeadEmail(lead: Pick<Lead, "token" | "name" | "itemsSummary" | "totalCents">, s: Settings) {
  const unsub = leadUnsubscribeUrl(lead.token);
  const tpl = checkoutRecoveryEmail(
    brandFromSettings(s),
    { firstName: lead.name?.split(/\s+/)[0] ?? null, lines: (lead.itemsSummary ?? "").split(" + ").filter(Boolean), totalCents: lead.totalCents },
    leadRecoveryUrl(lead.token),
    unsub,
    texts(s, "checkout")
  );
  return { ...tpl, headers: unsubHeaders(unsub) };
}

async function leadIneligible(lead: Lead, manual: boolean): Promise<string | null> {
  if (!lead.email) return "Sem e-mail";
  if (lead.orderId) return "Já virou pedido";
  if (!manual) {
    const optedOut =
      lead.emailOptOut ||
      (await db.checkoutLead.count({ where: { email: lead.email, emailOptOut: true } })) > 0 ||
      (await db.customer.count({ where: { email: lead.email, emailOptOutAt: { not: null } } })) > 0;
    if (optedOut) return "Pessoa descadastrou dos lembretes";
    if (Date.now() - lead.createdAt.getTime() > 72 * 3600_000) return "Checkout antigo (mais de 72h)";
    const ordered = await db.order.count({ where: { customer: { email: lead.email }, createdAt: { gte: lead.createdAt } } });
    if (ordered) return "Cliente gerou um pedido depois";
  }
  return null;
}

/** Envia o e-mail de checkout abandonado (reserva atômica). */
export async function sendLeadEmail(id: string, opts: { manual?: boolean } = {}) {
  const claimed = await db.checkoutLead.updateMany({
    where: { id, ...(opts.manual ? { NOT: { emailStatus: "SENDING" } } : { emailStatus: { in: ["SCHEDULED", "FAILED"] } }) },
    data: { emailStatus: "SENDING", emailAttempts: { increment: 1 } },
  });
  if (!claimed.count) return { ok: false as const, error: "E-mail já processado" };
  const lead = await db.checkoutLead.findUniqueOrThrow({ where: { id } });
  const reason = await leadIneligible(lead, Boolean(opts.manual));
  if (reason) {
    await db.checkoutLead.update({ where: { id }, data: { emailStatus: "SKIPPED", emailError: reason } });
    return { ok: false as const, error: reason };
  }
  const s = await getSettingsFresh();
  const { subject, html, text, headers } = renderLeadEmail(lead, s);
  const result = await deliver({ to: lead.email!, subject, html, text, headers, idempotencyKey: `cf-lead-${lead.id}-${lead.emailCount + 1}` }, s.contact_email || null);
  if (result.ok) {
    await db.checkoutLead.update({ where: { id }, data: { emailStatus: "SENT", emailSentAt: new Date(), emailCount: { increment: 1 }, emailError: null } });
    log.info("email", "checkout abandonado enviado", { lead: lead.id });
    return { ok: true as const };
  }
  const giveUp = Boolean(opts.manual) || !result.retryable || lead.emailAttempts >= 3;
  await db.checkoutLead.update({ where: { id }, data: { emailStatus: giveUp ? "FAILED" : "SCHEDULED", emailError: result.error, emailScheduledFor: new Date(Date.now() + 5 * 60_000) } });
  return { ok: false as const, error: result.error };
}

/** Envio manual pelo admin (anti-spam: 2 min). */
export async function resendLeadEmail(id: string) {
  if (emailProvider() === "none") return { ok: false as const, error: "E-mail não configurado: defina RESEND_API_KEY e EMAIL_FROM na Vercel." };
  const lead = await db.checkoutLead.findUnique({ where: { id } });
  if (!lead) return { ok: false as const, error: "Checkout não encontrado" };
  if (lead.emailSentAt && Date.now() - lead.emailSentAt.getTime() < 2 * 60_000) return { ok: false as const, error: "E-mail enviado há menos de 2 minutos. Aguarde para reenviar." };
  return sendLeadEmail(id, { manual: true });
}

export async function processDueLeadEmails(limit = 25) {
  await db.checkoutLead.updateMany({ where: { emailStatus: "SENDING", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { emailStatus: "SCHEDULED" } });
  const due = await db.checkoutLead.findMany({ where: { emailStatus: "SCHEDULED", emailScheduledFor: { lte: new Date() } }, orderBy: { emailScheduledFor: "asc" }, take: limit, select: { id: true } });
  let sent = 0;
  for (const l of due) if ((await sendLeadEmail(l.id)).ok) sent++;
  return { processed: due.length, sent };
}

// ───────────── Prévia e teste (admin) ─────────────

export type PreviewKind = "confirmation" | "recovery" | "checkout";

export async function renderPreview(kind: PreviewKind, s?: Settings) {
  const { sampleOrder } = await import("@/emails/sample");
  const settings = s ?? (await getSettingsFresh());
  const b = brandFromSettings(settings);
  const o = sampleOrder();
  const base = siteUrl();
  if (kind === "recovery") return pixRecoveryEmail(b, o, `${base}/pedido/exemplo`, `${base}/api/email/unsubscribe`, texts(settings, "recovery"));
  if (kind === "checkout") return checkoutRecoveryEmail(b, { firstName: o.firstName, lines: ["CLEARFINGER — 2 unidades (R$ 59,90)", "Adicione +1 frasco com desconto (R$ 39,90)"], totalCents: o.totalCents }, `${base}/checkout`, `${base}/api/email/unsubscribe`, texts(settings, "checkout"));
  return purchaseConfirmationEmail(b, { ...o, paymentLabel: "PIX" }, `${base}/pedido/exemplo`, `${base}/rastrear-pedido`, texts(settings, "confirmation"));
}

export async function sendTestEmail(kind: PreviewKind, to: string) {
  if (emailProvider() === "none") return { ok: false as const, error: "E-mail não configurado: defina RESEND_API_KEY e EMAIL_FROM na Vercel." };
  const s = await getSettingsFresh();
  const e = await renderPreview(kind, s);
  const r = await deliver({ to, subject: `[TESTE] ${e.subject}`, html: e.html, text: e.text }, s.contact_email || null);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}
