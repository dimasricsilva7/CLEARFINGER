import "server-only";
import { Prisma, type Order, type OrderStatus, type PaymentStatus as DbPaymentStatus } from "@prisma/client";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { bravopayMode, siteUrl } from "@/lib/env";
import { log } from "@/lib/log";
import { encryptField, hashIp, randomToken, safeEqual } from "@/lib/crypto";
import { paymentService, PaymentError, type PaymentSnapshot, type PaymentStatus } from "@/lib/payments";
import { computeTotals, formatOrderNumber, MIN_PIX_CENTS } from "@/lib/pricing";
import { CREDIARIO_TRANSITIONS, isPaidStatus, ORDER_STATUS_LABEL, type CrediarioStatus } from "@/lib/domain";
import { canTransition } from "@/lib/order-status";
import { crediarioConfig, installmentOptions, validateCrediario } from "@/lib/crediario";
import { classifyChannel, parseUserAgent } from "@/utils/channel";
import { linkSessionToCustomer, trackServerEvent } from "@/lib/analytics";
import { sendCapiEvent, fbcFromClickId } from "@/lib/meta/capi";
import { findSellableOffer } from "@/server/catalog";
import { publicTimeline, syncOrderTracking } from "@/server/delivery";
import { onOrderPaidEmail, onPixGeneratedEmail } from "@/lib/email";
import { linkLeadToOrder } from "@/server/checkout-leads";
import { getSettingsFresh, isOn, settingInt, shippingCentsFrom } from "@/server/settings";
import type { CheckoutInput } from "@/lib/validation";
import type { ClientContext } from "@/types/tracking";
import type { PublicOrder, PublicUpsell } from "@/types/order";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

const cut = (v: string | null | undefined, n = 200) => (v ? String(v).slice(0, n) : null);

// ───────────────────────── Linha do tempo do pedido ─────────────────────────

const SENSITIVE = /^(cpf|cpf_?last\d?|phone|document|customer|access_?token|authorization|api_?key|copy_?paste|pix|protocol|protocolo|validity|validade)$/i;
function sanitize(data: unknown): Prisma.InputJsonValue | undefined {
  if (data == null) return undefined;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, SENSITIVE.test(k) ? "[redacted]" : walk(val)]));
    return v;
  };
  return walk(data) as Prisma.InputJsonValue;
}

export async function logOrderEvent(orderId: string | null, type: string, message: string, data?: unknown, status?: string) {
  await db.paymentEvent
    .create({ data: { orderId, type, message: message.slice(0, 500), status: status ?? null, data: sanitize(data) } })
    .catch((e) => log.error("order-event", "falha ao registrar", { type, error: e instanceof Error ? e.message : String(e) }));
}

// ───────────────────────── Checkout ─────────────────────────

/** Código aleatório de 5 dígitos (CF27684-2026), sem repetir números já usados. */
async function uniqueOrderNumber(tx: Prisma.TransactionClient, seq: number) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const candidate = formatOrderNumber(year, randomInt(10000, 100000));
    if (!(await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } }))) return candidate;
  }
  return formatOrderNumber(year, 100000 + seq);
}

export type RequestMeta = { ip: string; userAgent: string | null; host: string | null };

function attributionFields(ctx: ClientContext | undefined, host: string | null) {
  const a = ctx?.attribution ?? {};
  const first = a.first ?? null;
  const last = a.last ?? a.first ?? null;
  const channel = classifyChannel({ source: last?.source, medium: last?.medium, fbclid: a.fbclid, gclid: a.gclid, ttclid: a.ttclid, referrer: a.referrer, siteHost: host });
  return {
    utmSource: cut(last?.source),
    utmMedium: cut(last?.medium),
    utmCampaign: cut(last?.campaign),
    utmContent: cut(last?.content),
    utmTerm: cut(last?.term),
    utmId: cut(last?.id, 64),
    firstTouchSource: cut(first?.source),
    firstTouchMedium: cut(first?.medium),
    firstTouchCampaign: cut(first?.campaign),
    firstTouchContent: cut(first?.content),
    firstTouchTerm: cut(first?.term),
    fbclid: cut(a.fbclid, 500),
    gclid: cut(a.gclid, 500),
    ttclid: cut(a.ttclid, 500),
    fbp: cut(ctx?.fbp),
    fbc: cut(ctx?.fbc, 500),
    landingPage: cut(a.landingPage, 500),
    referrer: cut(a.referrer, 500),
    sessionId: cut(ctx?.sessionId, 64),
    visitorId: cut(ctx?.visitorId, 64),
    adsConsent: Boolean(ctx?.adsConsent),
    channel,
  };
}

/**
 * Cria o pedido (PIX ou CREDIÁRIO). Idempotente por checkoutToken: duplo clique ou
 * retry de rede devolvem o mesmo pedido. Preços SEMPRE recalculados no servidor.
 */
export async function createCheckoutOrder(input: CheckoutInput, meta: RequestMeta) {
  const existing = await db.order.findUnique({ where: { checkoutToken: input.checkoutToken } });
  if (existing) {
    if (existing.paymentMethod === "PIX" && existing.status === "PENDING" && !existing.pixCopyPaste) return { order: await ensurePix(existing.id), reused: true };
    return { order: existing, reused: true };
  }

  const settings = await getSettingsFresh();
  const method = input.paymentMethod;
  if (method === "PIX" && (!isOn(settings.pix_enabled) || bravopayMode() === "disabled")) throw new CheckoutError("O pagamento via PIX está indisponível no momento. Tente novamente em alguns minutos.", 503);
  if (method === "CREDIARIO" && !isOn(settings.crediario_enabled)) throw new CheckoutError("O crediário está indisponível no momento.", 503);

  const offer = await findSellableOffer(input.offerId);
  if (!offer) throw new CheckoutError("Esta oferta não está mais disponível. Escolha outra opção.", 409);
  const quantity = Math.min(5, Math.max(1, input.quantity));
  if (offer.product.stockQuantity != null && offer.product.stockQuantity < offer.quantity * quantity) throw new CheckoutError("Quantidade indisponível no estoque.", 409);

  // Order bumps escolhidos no checkout — preço e disponibilidade sempre do banco
  const bumpIds = [...new Set(input.bumpIds ?? [])];
  const bumps = bumpIds.length
    ? await db.orderBump.findMany({ where: { id: { in: bumpIds }, active: true, priceCents: { gt: 0 }, product: { active: true } }, include: { product: true } })
    : [];
  if (bumps.length !== bumpIds.length) throw new CheckoutError("Uma das ofertas adicionais não está mais disponível. Revise o pedido.", 409);

  const shippingCents = shippingCentsFrom(settings);
  const totals = computeTotals([{ unitPriceCents: offer.priceCents, quantity }, ...bumps.map((b) => ({ unitPriceCents: b.priceCents, quantity: 1 }))], shippingCents);
  if (method === "PIX" && totals.totalCents < MIN_PIX_CENTS) throw new CheckoutError("O valor mínimo para pagamento via PIX é R$ 5,00.");
  if (isOn(settings.require_cpf) && !input.customer.cpf) throw new CheckoutError("Confira os dados informados.", 422, { "customer.cpf": "Informe seu CPF" });

  // CREDIÁRIO: validação server-side com a configuração atual (mesma regra do checkout)
  const cfg = crediarioConfig(settings);
  let crediarioRow: Omit<Prisma.CrediarioDataUncheckedCreateInput, "orderId"> | null = null;
  if (method === "CREDIARIO") {
    const c = input.crediario;
    if (!c) throw new CheckoutError(cfg.errorMessage, 422, { "crediario.protocol": cfg.protocolError });
    const errs = validateCrediario(c, cfg);
    if (Object.keys(errs).length) throw new CheckoutError(cfg.errorMessage, 422, Object.fromEntries(Object.entries(errs).map(([k, v]) => [`crediario.${k}`, v])));
    const option = installmentOptions(totals.totalCents, cfg).find((o) => o.n === c.installments)!;
    crediarioRow = {
      protocolEnc: encryptField(c.protocol),
      protocolLast4: c.protocol.slice(-4),
      validityEnc: encryptField(c.validity.trim()),
      cpfLast3Enc: encryptField(c.cpfLast3),
      validityFormat: cfg.validityFormat,
      installments: option.n,
      installmentCents: option.cents,
      installmentLabel: option.label,
      methodLabel: cfg.methodLabel,
    };
  }

  const attr = attributionFields(input.context, meta.host);
  const a = input.context?.attribution ?? {};
  const ua = parseUserAgent(meta.userAgent);
  const shippingAddress = { cep: input.address.cep, street: input.address.street, number: input.address.number, complement: input.address.complement || null, district: input.address.district, city: input.address.city, state: input.address.state };
  const customerSnapshot = { name: input.customer.name, email: input.customer.email, phone: input.customer.phone, cpf: input.customer.cpf || null };

  let order: Order;
  try {
    order = await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: input.customer.email },
        update: { name: input.customer.name, phone: input.customer.phone, ...(input.customer.cpf ? { cpf: input.customer.cpf } : {}), ...(input.marketingConsent ? { marketingConsent: true } : {}) },
        create: { name: input.customer.name, email: input.customer.email, phone: input.customer.phone, cpf: input.customer.cpf || null, marketingConsent: input.marketingConsent },
      });
      const created = await tx.order.create({
        data: {
          customerId: customer.id,
          customerSnapshot,
          shippingAddress,
          paymentMethod: method,
          status: method === "CREDIARIO" ? "CREDIARIO_PENDENTE" : "PENDING",
          paymentProvider: method === "PIX" ? "bravopay" : "crediario",
          ...totals,
          checkoutToken: input.checkoutToken,
          accessToken: randomToken(24),
          userAgent: cut(meta.userAgent, 300),
          device: ua.device,
          ipHash: hashIp(meta.ip),
          ...attr,
          items: {
            create: [
              {
                kind: "OFFER" as const,
                productId: offer.productId,
                offerId: offer.id,
                productName: offer.product.name,
                offerName: offer.name,
                sku: offer.product.sku,
                unitsPerOffer: offer.quantity,
                quantity,
                unitPriceCents: offer.priceCents,
                listPriceCents: offer.compareAtPriceCents ?? offer.priceCents,
                totalPriceCents: offer.priceCents * quantity,
              },
              ...bumps.map((b) => ({
                kind: "ORDER_BUMP" as const,
                bumpId: b.id,
                productId: b.productId,
                productName: b.product.name,
                offerName: b.title,
                sku: b.product.sku,
                unitsPerOffer: b.quantity,
                quantity: 1,
                unitPriceCents: b.priceCents,
                listPriceCents: b.compareAtPriceCents ?? b.priceCents,
                totalPriceCents: b.priceCents,
              })),
            ],
          },
          utm: {
            create: {
              source: attr.utmSource,
              medium: attr.utmMedium,
              campaign: attr.utmCampaign,
              content: attr.utmContent,
              term: attr.utmTerm,
              adset: cut(a.adset) ?? attr.utmTerm,
              ad: cut(a.ad) ?? attr.utmContent,
              gclid: attr.gclid,
              fbclid: attr.fbclid,
              ttclid: attr.ttclid,
              landingPage: attr.landingPage,
              referrer: attr.referrer,
              raw: sanitize(a) ?? undefined,
            },
          },
          ...(crediarioRow ? { crediario: { create: crediarioRow } } : {}),
        },
      });
      const orderNumber = await uniqueOrderNumber(tx, created.seq);
      return tx.order.update({ where: { id: created.id }, data: { orderNumber, externalReference: method === "PIX" ? orderNumber : null, metaEventId: `purchase_${created.id}` } });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.order.findUnique({ where: { checkoutToken: input.checkoutToken } });
      if (again) return { order: again, reused: true };
    }
    throw err;
  }

  await logOrderEvent(order.id, "order_created", `Pedido ${order.orderNumber} criado (${method === "PIX" ? "PIX" : cfg.methodLabel})`, {
    total: order.totalCents,
    offer: `${quantity}x ${offer.name}`,
    bumps: bumps.map((b) => b.title),
    installments: crediarioRow?.installments,
  });
  log.info("checkout", "pedido criado", { order: order.orderNumber, method, total: order.totalCents, channel: order.channel });
  await linkSessionToCustomer(order.sessionId, order.customerId);
  await linkLeadToOrder(input.leadKey, order.id, input.customer.email);
  await trackServerEvent(order, "order_created", { valueCents: order.totalCents, productId: offer.productId, offerId: offer.id, props: { method } });

  let result = order;
  if (method === "CREDIARIO") {
    await trackServerEvent(order, "crediario_order_created", { valueCents: order.totalCents, offerId: offer.id, props: { installments: crediarioRow!.installments } });
    await trackServerEvent(order, "crediario_pending", { valueCents: order.totalCents, offerId: offer.id });
  } else {
    result = await ensurePix(order.id);
  }

  // Meta: AddPaymentInfo (mesmo event_id do navegador → deduplicação). Nunca envia dados do crediário.
  if (input.paymentEventId && order.adsConsent && (method === "CREDIARIO" || result.pixCopyPaste)) {
    const [firstName, ...rest] = input.customer.name.split(/\s+/);
    await sendCapiEvent({
      eventName: "AddPaymentInfo",
      eventId: input.paymentEventId,
      eventSourceUrl: `${siteUrl()}/checkout`,
      user: {
        email: input.customer.email,
        phone: input.customer.phone,
        firstName,
        lastName: rest.at(-1),
        city: input.address.city,
        state: input.address.state,
        zip: input.address.cep,
        externalId: order.customerId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        fbc: order.fbc ?? fbcFromClickId(order.fbclid, order.createdAt),
        fbp: order.fbp,
      },
      customData: { currency: "BRL", value: order.totalCents / 100, content_type: "product", content_ids: [offer.product.sku], payment_type: method === "PIX" ? "pix" : "crediario" },
    });
  }
  return { order: result, reused: false };
}

/** Gera o PIX no gateway se o pedido ainda não tiver um. Seguro para chamar de novo. */
export async function ensurePix(orderId: string): Promise<Order> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: true } });
  if (order.paymentMethod !== "PIX" || order.pixCopyPaste || order.status !== "PENDING") return order;

  const settings = await getSettingsFresh();
  const expiresIn = Math.min(1440, Math.max(5, settingInt(settings, "pix_expiration_minutes", 30))) * 60;
  const main = order.items[0];
  const store = settings.store_name || "CLEARFINGER";
  const description = `${store} ${order.orderNumber} — ${order.items.map((i) => `${i.quantity}x ${i.offerName}`).join(", ")}`;
  const snap = order.customerSnapshot as { cpf?: string | null };

  await logOrderEvent(order.id, "payment_request", "Solicitando PIX ao gateway", { amount_cents: order.totalCents, external_reference: order.externalReference, expires_in: expiresIn });

  try {
    const charge = await paymentService.createPixPayment({
      amountCents: order.totalCents,
      idempotencyKey: order.externalReference === order.orderNumber ? `clearfinger-${order.id}` : `clearfinger-${order.id}-${order.externalReference}`,
      externalReference: order.externalReference!,
      description,
      customer: { name: order.customer.name, email: order.customer.email, cpf: snap.cpf ?? order.customer.cpf ?? "", phone: order.customer.phone },
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber ?? "",
        product_id: main?.productId ?? "",
        offer_id: main?.offerId ?? "",
        sku: main?.sku ?? "",
        session_id: order.sessionId ?? "",
        customer_id: order.customerId,
      },
      utm: { source: order.utmSource, medium: order.utmMedium, campaign: order.utmCampaign, content: order.utmContent, term: order.utmTerm, fbclid: order.fbclid, gclid: order.gclid, ttclid: order.ttclid },
      expiresInSeconds: expiresIn,
    });

    const moved = await db.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "PIX_GENERATED",
        transactionId: charge.transactionId,
        pixCopyPaste: charge.copyPaste,
        pixExpiresAt: charge.expiresAt ?? new Date(Date.now() + expiresIn * 1000),
        feeCents: charge.feeCents,
        netCents: charge.netCents,
        paymentError: null,
      },
    });
    if (moved.count) {
      await db.payment.upsert({
        where: { transactionId: charge.transactionId },
        update: {},
        create: { orderId: order.id, provider: charge.provider, transactionId: charge.transactionId, status: "PENDING", amountCents: charge.amountCents, feeCents: charge.feeCents, netCents: charge.netCents, metadata: sanitize(charge.metadata) },
      });
      await logOrderEvent(order.id, "payment_response", "PIX gerado", { transaction_id: charge.transactionId, status: charge.status, expires_at: charge.expiresAt }, "PIX_GENERATED");
      await trackServerEvent(order, "pix_generated", { valueCents: order.totalCents, productId: main?.productId, offerId: main?.offerId });
      await trackServerEvent(order, "payment_pending", { valueCents: order.totalCents });
      // lembrete por e-mail se o PIX não for pago (padrão 10 min; cancelado ao pagar)
      await onPixGeneratedEmail(order.id, order.customer.email).catch((e) => log.error("email", "falha ao agendar lembrete", { order: order.orderNumber, error: e instanceof Error ? e.message : String(e) }));
    }
    return db.order.findUniqueOrThrow({ where: { id: order.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    const code = err instanceof PaymentError ? err.code : undefined;
    await db.order.update({ where: { id: order.id }, data: { paymentError: message.slice(0, 300) } });
    await logOrderEvent(order.id, "payment_error", `Falha ao gerar PIX: ${message}`, { code, status: err instanceof PaymentError ? err.status : undefined }, "ERROR");
    await trackServerEvent(order, "pix_error", { props: { code: code ?? null } });
    log.error("checkout", "falha ao gerar PIX", { order: order.orderNumber, code, message });
    throw new CheckoutError("Não conseguimos gerar o PIX agora. Tente novamente.", 502);
  }
}

// ───────────────────────── Status de pagamento (PIX) ─────────────────────────

const STATUS_MAP: Record<PaymentStatus, { order: OrderStatus | null; payment: DbPaymentStatus }> = {
  PENDING: { order: null, payment: "PENDING" },
  PAID: { order: "PAID", payment: "PAID" },
  EXPIRED: { order: "EXPIRED", payment: "EXPIRED" },
  REFUNDED: { order: "REFUNDED", payment: "REFUNDED" },
  CHARGEBACK: { order: "CHARGEBACK", payment: "CHARGEBACK" },
  FAILED: { order: "FAILED", payment: "FAILED" },
};

export type ApplyResult = { order: Order | null; previousStatus: OrderStatus | null; newStatus: OrderStatus | null; changed: boolean; note?: string };

/**
 * ÚNICO ponto do sistema que altera o status de pagamento PIX de um pedido.
 * Chamado pelo webhook (push), polling e reconciliação (pull). Nunca pelo navegador.
 * Os efeitos de "pago" rodam exatamente uma vez (update condicional no banco).
 */
export async function applyPaymentSnapshot(
  orderId: string,
  snap: PaymentSnapshot,
  source: "webhook" | "poll" | "reconcile" | "admin",
  statusOverride?: PaymentStatus | null
): Promise<ApplyResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { order: null, previousStatus: null, newStatus: null, changed: false, note: "order_not_found" };
  if (order.paymentMethod !== "PIX") return { order, previousStatus: order.status, newStatus: order.status, changed: false, note: "not_pix" };

  const remote = statusOverride ?? snap.status;
  const mapped = STATUS_MAP[remote];
  if (!mapped) {
    await logOrderEvent(order.id, "status_ignored", `Status desconhecido "${remote}" (${source})`, { transaction_id: snap.transactionId });
    return { order, previousStatus: order.status, newStatus: order.status, changed: false, note: "unknown_status" };
  }
  await db.order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
  if (!mapped.order) return { order, previousStatus: order.status, newStatus: order.status, changed: false, note: "still_pending" };

  if (mapped.order === "PAID" && snap.amountCents < order.totalCents) {
    await logOrderEvent(order.id, "amount_mismatch", `Valor pago (${snap.amountCents}) menor que o total (${order.totalCents}) — não marcado como pago`, { transaction_id: snap.transactionId, source }, "WARNING");
    log.warn("payment", "valor divergente", { order: order.orderNumber, paid: snap.amountCents, total: order.totalCents });
    return { order, previousStatus: order.status, newStatus: order.status, changed: false, note: "amount_mismatch" };
  }
  if (!canTransition(order.status, mapped.order)) return { order, previousStatus: order.status, newStatus: order.status, changed: false, note: "transition_not_allowed" };

  const now = new Date();
  const paidAt = mapped.order === "PAID" ? (snap.paidAt ?? now) : undefined;
  const moved = await db.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      status: mapped.order,
      paymentStatus: mapped.payment,
      transactionId: order.transactionId ?? snap.transactionId,
      feeCents: snap.feeCents ?? order.feeCents,
      netCents: snap.netCents ?? order.netCents,
      ...(paidAt ? { paidAt, paidAmountCents: snap.amountCents } : {}),
      ...(mapped.order === "EXPIRED" ? { expiredAt: now } : {}),
    },
  });
  if (moved.count === 0) {
    const current = await db.order.findUnique({ where: { id: order.id } });
    return { order: current, previousStatus: order.status, newStatus: current?.status ?? null, changed: false, note: "concurrent_update" };
  }

  await db.payment.upsert({
    where: { transactionId: snap.transactionId },
    update: { status: mapped.payment, feeCents: snap.feeCents ?? undefined, netCents: snap.netCents ?? undefined, tracking: sanitize(snap.tracking), ...(paidAt ? { paidAt } : {}) },
    create: {
      orderId: order.id,
      provider: snap.provider,
      transactionId: snap.transactionId,
      status: mapped.payment,
      amountCents: snap.amountCents,
      feeCents: snap.feeCents,
      netCents: snap.netCents,
      paidAt: paidAt ?? null,
      metadata: sanitize(snap.metadata),
      tracking: sanitize(snap.tracking),
    },
  });
  await logOrderEvent(order.id, "status_change", `${order.status} → ${mapped.order} (${source})`, { transaction_id: snap.transactionId, amount_cents: snap.amountCents, fee_cents: snap.feeCents, net_cents: snap.netCents }, mapped.order);
  log.info("payment", "status alterado", { order: order.orderNumber, from: order.status, to: mapped.order, source });

  if (mapped.order === "PAID") await onConfirmed(order.id);
  if (mapped.order === "EXPIRED") await trackServerEvent(order, "payment_expired", { valueCents: order.totalCents });
  if (mapped.order === "FAILED") await trackServerEvent(order, "payment_failed", { valueCents: order.totalCents });

  const updated = await db.order.findUnique({ where: { id: order.id } });
  return { order: updated, previousStatus: order.status, newStatus: mapped.order, changed: true };
}

/**
 * Venda confirmada (PIX pago ou crediário aprovado): estoque, evento `purchase` e Meta Purchase (CAPI).
 * Protegido contra execução dupla por purchaseTrackedAt.
 */
async function onConfirmed(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: { include: { product: true } } } });

  const tracked = await db.order.updateMany({ where: { id: order.id, purchaseTrackedAt: null }, data: { purchaseTrackedAt: new Date() } });
  if (!tracked.count) return;

  // confirmação de compra por e-mail (e cancela o lembrete de PIX)
  await onOrderPaidEmail(order.id, order.customer.email).catch((e) => log.error("email", "falha na confirmação", { order: order.orderNumber, error: e instanceof Error ? e.message : String(e) }));

  // etapa 1 da linha do tempo de entrega ("Pagamento concluído") na hora da confirmação
  await syncOrderTracking(order).catch((e) => log.error("tracking", "falha ao iniciar linha do tempo", { order: order.id, error: e instanceof Error ? e.message : String(e) }));

  for (const item of order.items) {
    if (item.productId && item.product?.stockQuantity != null) {
      await db.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity * item.unitsPerOffer } } }).catch(() => {});
    }
  }

  const value = order.paidAmountCents ?? order.totalCents;
  const main = order.items[0];
  await trackServerEvent(order, "purchase", { valueCents: value, productId: main?.productId, offerId: main?.offerId, props: { order: order.orderNumber, method: order.paymentMethod } });

  if (!order.adsConsent) return; // sem consentimento de marketing: nada vai para a Meta
  const address = (order.shippingAddress ?? {}) as { city?: string; state?: string; cep?: string };
  const [firstName, ...rest] = order.customer.name.split(/\s+/);
  await sendCapiEvent({
    eventName: "Purchase",
    eventId: order.metaEventId ?? `purchase_${order.id}`,
    eventSourceUrl: `${siteUrl()}/pedido/${order.orderNumber}`,
    eventTime: Math.floor((order.paidAt ?? order.approvedAt ?? new Date()).getTime() / 1000),
    user: {
      email: order.customer.email,
      phone: order.customer.phone,
      firstName,
      lastName: rest.at(-1),
      city: address.city,
      state: address.state,
      zip: address.cep,
      externalId: order.customerId,
      userAgent: order.userAgent,
      fbc: order.fbc ?? fbcFromClickId(order.fbclid, order.createdAt),
      fbp: order.fbp,
    },
    customData: {
      currency: "BRL",
      value: value / 100,
      order_id: order.orderNumber,
      content_type: "product",
      content_ids: order.items.map((i) => i.sku),
      contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity * i.unitsPerOffer, item_price: i.unitPriceCents / 100 / Math.max(1, i.unitsPerOffer) })),
      num_items: order.items.reduce((s, i) => s + i.quantity * i.unitsPerOffer, 0),
    },
  });
}

/**
 * PIX vencido → novo código no MESMO pedido (mesmo número, link e valores congelados).
 * Usa uma nova external_reference (CF12345-2026-R2-xxx) para o gateway criar outra cobrança.
 */
export async function renewPix(orderId: string): Promise<Order> {
  let order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentMethod !== "PIX") return order;
  const isAwaiting = (o: Order) => o.status === "PENDING" || o.status === "PIX_GENERATED";
  if (isAwaiting(order) && order.pixCopyPaste) {
    if (!order.pixExpiresAt || order.pixExpiresAt.getTime() > Date.now()) return order; // ainda válido
    order = await syncOrder(order, { minIntervalMs: 0, source: "poll" }); // pago no último segundo?
  }
  const expiredAwaiting = isAwaiting(order) && !!order.pixExpiresAt && order.pixExpiresAt.getTime() <= Date.now();
  if (order.status !== "EXPIRED" && order.status !== "FAILED" && !expiredAwaiting) return order;
  const attempt = (await db.payment.count({ where: { orderId } })) + 1;
  const ref = `${order.orderNumber}-R${attempt}-${randomInt(100, 1000)}`;
  const moved = await db.order.updateMany({
    where: { id: order.id, status: order.status, externalReference: order.externalReference },
    data: { status: "PENDING", paymentStatus: "PENDING", externalReference: ref, transactionId: null, pixCopyPaste: null, pixExpiresAt: null, paymentError: null, lastCheckedAt: null },
  });
  if (!moved.count) return db.order.findUniqueOrThrow({ where: { id: order.id } });
  await logOrderEvent(order.id, "pix_renewed", `Novo PIX solicitado pelo cliente (anterior: ${order.status})`, { previous_reference: order.externalReference, new_reference: ref }, "PENDING");
  return ensurePix(order.id);
}

const FINAL: OrderStatus[] = ["PAID", "REFUNDED", "CHARGEBACK", "CANCELLED"];

/** Consulta o gateway e aplica o status (pull). Throttled por lastCheckedAt. */
export async function syncOrder(order: Order, opts: { minIntervalMs?: number; source?: "poll" | "reconcile" | "admin" } = {}) {
  const minInterval = opts.minIntervalMs ?? 5000;
  if (order.paymentMethod !== "PIX" || FINAL.includes(order.status) || !order.externalReference || !order.pixCopyPaste) return order;
  if (order.lastCheckedAt && Date.now() - new Date(order.lastCheckedAt).getTime() < minInterval) return order;

  await db.order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
  try {
    const snap = await paymentService.getPaymentStatus(order.externalReference);
    if (snap && snap.status !== "PENDING") return (await applyPaymentSnapshot(order.id, snap, opts.source ?? "poll")).order ?? order;
  } catch (err) {
    await logOrderEvent(order.id, "poll_error", `Falha na consulta: ${err instanceof Error ? err.message : "erro"}`, undefined, "ERROR");
    return order;
  }

  // Sem confirmação e PIX vencido há mais de 10 min → expira localmente.
  if (order.status === "PIX_GENERATED" && order.pixExpiresAt && new Date(order.pixExpiresAt).getTime() < Date.now() - 10 * 60_000) {
    const moved = await db.order.updateMany({ where: { id: order.id, status: "PIX_GENERATED" }, data: { status: "EXPIRED", paymentStatus: "EXPIRED", expiredAt: new Date() } });
    if (moved.count) {
      await logOrderEvent(order.id, "status_change", "PIX_GENERATED → EXPIRED (prazo do PIX encerrado)", undefined, "EXPIRED");
      await trackServerEvent(order, "payment_expired", { valueCents: order.totalCents });
    }
    return (await db.order.findUnique({ where: { id: order.id } })) ?? order;
  }
  return order;
}

/** Reconciliação server-side de PIX pendentes (cron/tick). Limitada para respeitar o rate limit da API. */
export async function reconcilePendingOrders(limit = 20) {
  const pending = await db.order.findMany({
    where: {
      paymentMethod: "PIX",
      status: "PIX_GENERATED",
      createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 2 * 60_000) } }],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });
  let paid = 0;
  let expired = 0;
  for (const o of pending) {
    const r = await syncOrder(o, { minIntervalMs: 0, source: "reconcile" });
    if (r?.status === "PAID") paid++;
    if (r?.status === "EXPIRED") expired++;
  }
  // Pedidos PIX que nunca conseguiram gerar o código há mais de 24h → cancelados
  const stale = await db.order.updateMany({
    where: { paymentMethod: "PIX", status: "PENDING", pixCopyPaste: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  return { checked: pending.length, paid, expired, cancelledWithoutPix: stale.count };
}

// ───────────────────────── CREDIÁRIO (status manual pelo admin) ─────────────────────────

const CREDIARIO_EVENT: Partial<Record<CrediarioStatus, "crediario_in_review" | "crediario_approved" | "crediario_rejected" | "crediario_cancelled" | "crediario_pending">> = {
  CREDIARIO_PENDENTE: "crediario_pending",
  CREDIARIO_EM_ANALISE: "crediario_in_review",
  CREDIARIO_APROVADO: "crediario_approved",
  CREDIARIO_RECUSADO: "crediario_rejected",
  CREDIARIO_CANCELADO: "crediario_cancelled",
};

export async function updateCrediarioStatus(orderId: string, next: CrediarioStatus, actor: string, note?: string | null) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentMethod !== "CREDIARIO") throw new Error("Este pedido não é do crediário.");
  const from = order.status as CrediarioStatus;
  if (from === next) return { order, changed: false };
  if (!CREDIARIO_TRANSITIONS[from]?.includes(next)) throw new Error(`Transição não permitida: ${ORDER_STATUS_LABEL[from]} → ${ORDER_STATUS_LABEL[next]}.`);

  const now = new Date();
  const moved = await db.order.updateMany({
    where: { id: order.id, status: from },
    data: {
      status: next,
      ...(next === "CREDIARIO_APROVADO" ? { approvedAt: now, paymentStatus: "PAID" } : {}),
      ...(next === "CREDIARIO_RECUSADO" ? { rejectedAt: now, paymentStatus: "FAILED" } : {}),
      ...(next === "CREDIARIO_CANCELADO" ? { cancelledAt: now } : {}),
    },
  });
  if (!moved.count) throw new Error("O status do pedido mudou. Recarregue a página.");
  if (note) await db.crediarioData.update({ where: { orderId }, data: { analysisNote: note.slice(0, 1000) } }).catch(() => {});
  await logOrderEvent(order.id, "status_change", `${ORDER_STATUS_LABEL[from]} → ${ORDER_STATUS_LABEL[next]} (${actor})`, note ? { note } : undefined, next);
  const ev = CREDIARIO_EVENT[next];
  if (ev) await trackServerEvent(order, ev, { valueCents: order.totalCents });
  if (next === "CREDIARIO_APROVADO") await onConfirmed(order.id);
  return { order: await db.order.findUniqueOrThrow({ where: { id: order.id } }), changed: true };
}

// ───────────────────────── Acesso público ao pedido ─────────────────────────

export async function findOrderByAccess(orderNumber: string | null | undefined, token: string | null | undefined) {
  if (!orderNumber || !token || token.length < 16 || orderNumber.length > 40) return null;
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true, customer: { select: { name: true } }, crediario: { select: { installments: true, installmentLabel: true, methodLabel: true } } },
  });
  if (!order || !safeEqual(order.accessToken, token)) return null;
  return order;
}

type AccessOrder = NonNullable<Awaited<ReturnType<typeof findOrderByAccess>>>;

/** Versão pública do pedido — nunca inclui protocolo, validade ou dígitos do CPF. */
export function toPublicOrder(o: AccessOrder): PublicOrder {
  const awaiting = o.status === "PENDING" || o.status === "PIX_GENERATED";
  return {
    orderNumber: o.orderNumber!,
    status: o.status,
    paymentMethod: o.paymentMethod,
    fulfillmentStatus: o.fulfillmentStatus,
    totalCents: o.totalCents,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    pixCopyPaste: awaiting ? o.pixCopyPaste : null,
    pixExpiresAt: o.pixExpiresAt?.toISOString() ?? null,
    paidAt: (o.paidAt ?? o.approvedAt)?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    metaEventId: isPaidStatus(o.status) ? o.metaEventId : null,
    customerFirstName: o.customer.name.split(/\s+/)[0],
    trackingCode: o.trackingCode,
    pixError: awaiting && !o.pixCopyPaste && Boolean(o.paymentError),
    crediario: o.crediario ? { installments: o.crediario.installments, installmentLabel: o.crediario.installmentLabel, methodLabel: o.crediario.methodLabel } : null,
    items: o.items.map((i) => ({ name: i.productName, offerName: i.offerName, kind: i.kind, quantity: i.quantity, units: i.unitsPerOffer, unitPriceCents: i.unitPriceCents, totalPriceCents: i.totalPriceCents })),
  };
}

// ───────────────────────── Upsell (pós-compra) ─────────────────────────

type UpsellEligible = Pick<Order, "id" | "status" | "paymentMethod" | "source">;

function triggerMatches(trigger: string, o: UpsellEligible) {
  const pixPaid = o.paymentMethod === "PIX" && o.status === "PAID";
  const crediario = o.paymentMethod === "CREDIARIO" && ["CREDIARIO_PENDENTE", "CREDIARIO_EM_ANALISE", "CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"].includes(o.status);
  if (trigger === "PIX_PAID") return pixPaid;
  if (trigger === "CREDIARIO_CREATED") return crediario;
  return pixPaid || crediario;
}

/** Upsell a exibir neste pedido (um por pedido). Nunca em pedidos que já são upsell nem depois de aceito/recusado. */
export async function upsellForOrder(o: UpsellEligible): Promise<PublicUpsell | null> {
  if (o.source === "UPSELL") return null;
  const [answered, child] = await Promise.all([
    db.upsellEvent.count({ where: { orderId: o.id, action: { in: ["ACCEPT", "DECLINE"] } } }),
    db.order.count({ where: { parentOrderId: o.id } }),
  ]);
  if (answered || child) return null;
  const list = await db.upsell.findMany({
    where: { active: true, priceCents: { gt: 0 }, product: { active: true } },
    include: { product: { include: { images: { where: { role: "MAIN" }, take: 1 } } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const u = list.find((x) => triggerMatches(x.trigger, o));
  if (!u) return null;
  return {
    id: u.id,
    title: u.title,
    description: u.description,
    productName: u.product.shortName || u.product.name,
    quantity: u.quantity,
    priceCents: u.priceCents,
    compareAtPriceCents: u.compareAtPriceCents,
    imageUrl: u.imageUrl || u.product.images[0]?.url || null,
    badge: u.badge,
    acceptLabel: u.acceptLabel,
    declineLabel: u.declineLabel,
    position: u.position === "BOTTOM" ? "BOTTOM" : "TOP",
  };
}

export async function recordUpsellEvent(upsellId: string, orderId: string, action: "VIEW" | "ACCEPT" | "DECLINE") {
  await db.upsellEvent.create({ data: { upsellId, orderId, action } }).catch(() => null); // único por (upsell, pedido, ação)
}

/**
 * Aceite do upsell: cria um NOVO pedido PIX vinculado ao original (mesmo cliente, endereço e atribuição).
 * O pedido original não é alterado — se algo falhar aqui, ele segue intacto.
 */
export async function acceptUpsell(parent: Order, upsellId: string) {
  const offer = await upsellForOrder(parent);
  if (!offer || offer.id !== upsellId) throw new CheckoutError("Esta oferta não está mais disponível.", 409);
  const settings = await getSettingsFresh();
  if (!isOn(settings.pix_enabled) || bravopayMode() === "disabled") throw new CheckoutError("O PIX está indisponível no momento. Tente novamente em alguns minutos.", 503);
  const u = await db.upsell.findUniqueOrThrow({ where: { id: upsellId }, include: { product: true } });
  if (u.product.stockQuantity != null && u.product.stockQuantity < u.quantity) throw new CheckoutError("Produto indisponível no estoque.", 409);
  const totals = computeTotals([{ unitPriceCents: u.priceCents, quantity: 1 }], 0);
  if (totals.totalCents < MIN_PIX_CENTS) throw new CheckoutError("O valor mínimo para pagamento via PIX é R$ 5,00.");

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerId: parent.customerId,
        customerSnapshot: parent.customerSnapshot as Prisma.InputJsonValue,
        shippingAddress: (parent.shippingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
        paymentMethod: "PIX",
        status: "PENDING",
        paymentProvider: "bravopay",
        ...totals,
        checkoutToken: `upsell_${parent.id}_${u.id}`, // idempotente: duplo clique devolve o mesmo pedido
        accessToken: randomToken(24),
        parentOrderId: parent.id,
        source: "UPSELL",
        upsellId: u.id,
        adsConsent: parent.adsConsent,
        utmSource: parent.utmSource,
        utmMedium: parent.utmMedium,
        utmCampaign: parent.utmCampaign,
        utmContent: parent.utmContent,
        utmTerm: parent.utmTerm,
        firstTouchSource: parent.firstTouchSource,
        firstTouchMedium: parent.firstTouchMedium,
        firstTouchCampaign: parent.firstTouchCampaign,
        fbclid: parent.fbclid,
        gclid: parent.gclid,
        fbp: parent.fbp,
        fbc: parent.fbc,
        sessionId: parent.sessionId,
        visitorId: parent.visitorId,
        device: parent.device,
        userAgent: parent.userAgent,
        ipHash: parent.ipHash,
        channel: parent.channel,
        landingPage: parent.landingPage,
        items: {
          create: [
            {
              kind: "UPSELL" as const,
              productId: u.productId,
              productName: u.product.name,
              offerName: u.title,
              sku: u.product.sku,
              unitsPerOffer: u.quantity,
              quantity: 1,
              unitPriceCents: u.priceCents,
              listPriceCents: u.compareAtPriceCents ?? u.priceCents,
              totalPriceCents: u.priceCents,
            },
          ],
        },
      },
    });
    const orderNumber = await uniqueOrderNumber(tx, created.seq);
    return tx.order.update({ where: { id: created.id }, data: { orderNumber, externalReference: orderNumber, metaEventId: `purchase_${created.id}` } });
  }).catch(async (err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.order.findUnique({ where: { checkoutToken: `upsell_${parent.id}_${u.id}` } });
      if (again) return again;
    }
    throw err;
  });

  await recordUpsellEvent(u.id, parent.id, "ACCEPT");
  await logOrderEvent(order.id, "order_created", `Pedido ${order.orderNumber} criado (upsell do pedido ${parent.orderNumber})`, { total: order.totalCents, upsell: u.title });
  await logOrderEvent(parent.id, "upsell_accepted", `Upsell aceito — novo pedido ${order.orderNumber}`, { upsell: u.title });
  await trackServerEvent(order, "order_created", { valueCents: order.totalCents, productId: u.productId, props: { method: "PIX", source: "upsell" } });
  return order.pixCopyPaste ? order : ensurePix(order.id);
}

/** Dados extras da página do pedido: upsell elegível, linha do tempo de entrega e textos de frete. */
export async function withOrderExtras(o: AccessOrder, pub: PublicOrder): Promise<PublicOrder> {
  const settings = await getSettingsFresh();
  const [upsell, tl] = await Promise.all([
    upsellForOrder(o).catch(() => null),
    publicTimeline(o, settings).catch(() => ({ events: [], delivered: false })),
  ]);
  return { ...pub, upsell, timeline: tl.events, etaText: settings.shipping_eta_text, shippingLabel: isOn(settings.shipping_free_enabled) ? settings.shipping_label : "" };
}
