import "server-only";
import type { Order, OrderTrackingEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { sha256, safeEqual } from "@/lib/crypto";
import { isPaidStatus, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { AUTOMATIC_STAGES, dueStages, parseHolidays, STAGE_FULFILLMENT, stageDefs, stageRank, type StageCode } from "@/lib/delivery";
import { getSettingsFresh, isOn, type Settings } from "@/server/settings";
import type { PublicTrackingEvent } from "@/types/order";

/**
 * Linha do tempo de entrega. Um único agendador global (job + materialização sob demanda ao abrir o
 * rastreio/pedido) grava as etapas automáticas que já venceram — nada de cron por pedido.
 */

type OrderForTracking = Pick<Order, "id" | "status" | "paidAt" | "approvedAt" | "fulfillmentStatus" | "shippedAt" | "deliveredAt">;

const STOP_STATUSES = new Set(["CANCELLED", "REFUNDED", "CREDIARIO_CANCELADO", "CREDIARIO_RECUSADO"]);

/** Início da contagem: pagamento PIX confirmado ou crediário aprovado. */
export function trackingStart(o: Pick<Order, "status" | "paidAt" | "approvedAt">): Date | null {
  if (!isPaidStatus(o.status) || STOP_STATUSES.has(o.status)) return null;
  return o.paidAt ?? o.approvedAt ?? null;
}

const FULFILLMENT_RANK = { PENDING: 0, PROCESSING: 1, SHIPPED: 2, DELIVERED: 3 } as const;

/** Atualiza Order.fulfillmentStatus (só avança) a partir da etapa mais recente visível. */
async function syncFulfillment(order: OrderForTracking, events: Pick<OrderTrackingEvent, "status" | "hidden" | "occurredAt">[]) {
  const visible = events.filter((e) => !e.hidden && stageRank(e.status) >= 0).sort((a, b) => stageRank(b.status) - stageRank(a.status));
  const top = visible[0];
  const target = top ? STAGE_FULFILLMENT[top.status as StageCode] : undefined;
  if (!target || FULFILLMENT_RANK[target] <= FULFILLMENT_RANK[order.fulfillmentStatus]) return;
  await db.order.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: target,
      ...(target !== "PROCESSING" && !order.shippedAt ? { shippedAt: visible.find((e) => e.status === "DISPATCHED")?.occurredAt ?? top.occurredAt } : {}),
      ...(target === "DELIVERED" && !order.deliveredAt ? { deliveredAt: top.occurredAt } : {}),
    },
  });
}

/** Grava as etapas automáticas vencidas que ainda não existem (idempotente). */
export async function syncOrderTracking(order: OrderForTracking, settings?: Settings, now = new Date()): Promise<number> {
  const start = trackingStart(order);
  if (!start) return 0;
  const s = settings ?? (await getSettingsFresh());
  const existing = await db.orderTrackingEvent.findMany({ where: { orderId: order.id }, select: { status: true, automatic: true, hidden: true, occurredAt: true } });
  const delivered = existing.some((e) => e.status === "DELIVERED" && !e.hidden);
  let created = 0;
  if (isOn(s.tracking_auto_enabled) && !delivered) {
    const have = new Set(existing.filter((e) => e.automatic).map((e) => e.status)); // ocultadas também contam: correção não é refeita
    const missing = dueStages(start, now, { holidays: parseHolidays(s.tracking_holidays), settings: s }).filter((st) => !have.has(st.code));
    if (missing.length) {
      const r = await db.orderTrackingEvent.createMany({
        data: missing.map((st) => ({ orderId: order.id, status: st.code, title: st.title, description: st.description, occurredAt: st.at, automatic: true })),
        skipDuplicates: true,
      });
      created = r.count;
      existing.push(...missing.map((st) => ({ status: st.code, automatic: true, hidden: false, occurredAt: st.at })));
    }
  }
  await syncFulfillment(order, existing);
  return created;
}

/** Job global: pedidos pagos nos últimos 30 dias ainda não entregues. */
export async function syncDueTracking(limit = 200) {
  const settings = await getSettingsFresh();
  if (!isOn(settings.tracking_auto_enabled)) return { orders: 0, created: 0 };
  const since = new Date(Date.now() - 30 * 86_400_000);
  const orders = await db.order.findMany({
    where: {
      status: { in: ["PAID", "CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"] },
      fulfillmentStatus: { not: "DELIVERED" },
      OR: [{ paidAt: { gte: since } }, { approvedAt: { gte: since } }],
    },
    select: { id: true, status: true, paidAt: true, approvedAt: true, fulfillmentStatus: true, shippedAt: true, deliveredAt: true, _count: { select: { trackingEvents: { where: { automatic: true } } } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let created = 0;
  for (const o of orders) {
    if (o._count.trackingEvents >= AUTOMATIC_STAGES.length) continue;
    created += await syncOrderTracking(o, settings).catch((e) => {
      log.error("tracking", "falha ao sincronizar linha do tempo", { order: o.id, error: e instanceof Error ? e.message : String(e) });
      return 0;
    });
  }
  return { orders: orders.length, created };
}

/** Eventos visíveis + próximas etapas (sem data) para a timeline pública. */
export async function publicTimeline(order: OrderForTracking, settings: Settings): Promise<{ events: PublicTrackingEvent[]; delivered: boolean }> {
  await syncOrderTracking(order, settings);
  const rows = await db.orderTrackingEvent.findMany({ where: { orderId: order.id, hidden: false }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] });
  const events: PublicTrackingEvent[] = rows.map((e) => ({ status: e.status, title: e.title, description: e.description, at: e.occurredAt.toISOString(), done: true }));
  const delivered = rows.some((e) => e.status === "DELIVERED");
  if (trackingStart(order) && !delivered) {
    const reached = Math.max(-1, ...rows.map((e) => stageRank(e.status)));
    for (const d of stageDefs(settings)) if (stageRank(d.code) > reached) events.push({ status: d.code, title: d.title, description: null, at: "", done: false });
  }
  return { events, delivered };
}

// ───────────── Consulta pública (/rastrear-pedido) ─────────────

export const normalizeOrderNumber = (v: string) => v.toUpperCase().replace(/[\s#]/g, "").slice(0, 40);
const digits = (v: string) => v.replace(/\D/g, "");

/** Bloqueio persistente (entre instâncias): falhas por IP e por número de pedido. */
export async function trackingLookupBlocked(ipKey: string, orderNumber: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000);
  const [byIp, byOrder] = await Promise.all([
    db.loginAttempt.count({ where: { key: `track:ip:${ipKey}`, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { key: `track:order:${sha256(orderNumber)}`, success: false, createdAt: { gte: since } } }),
  ]);
  return byIp >= 15 || byOrder >= 6;
}

export async function recordTrackingLookup(ipKey: string, orderNumber: string, success: boolean) {
  if (success) return;
  await db.loginAttempt.createMany({ data: [{ key: `track:ip:${ipKey}`, success }, { key: `track:order:${sha256(orderNumber)}`, success }] }).catch(() => null);
}

/** Pedido + CPF ou pedido + e-mail. Qualquer divergência → null (resposta genérica, sem dizer o que falhou). */
export async function findOrderForTracking(orderNumberRaw: string, contact: { cpf?: string; email?: string }) {
  const orderNumber = normalizeOrderNumber(orderNumberRaw);
  const order = orderNumber.length >= 6 ? await db.order.findUnique({ where: { orderNumber }, include: { items: true, customer: { select: { name: true, email: true, cpf: true } } } }) : null;
  const snap = (order?.customerSnapshot ?? {}) as { cpf?: string | null; email?: string | null };
  const cpf = digits(contact.cpf ?? "");
  const email = (contact.email ?? "").trim().toLowerCase();
  // compara hashes de tamanho fixo (tempo constante) mesmo quando o pedido não existe
  const want = cpf.length === 11 ? `cpf:${cpf}` : email.includes("@") ? `email:${email}` : "invalid";
  const candidates = order ? [`cpf:${digits(snap.cpf ?? order.customer.cpf ?? "")}`, `email:${(snap.email ?? order.customer.email).toLowerCase()}`] : ["none:", "none:"];
  const ok = candidates.map((c) => safeEqual(sha256(c), sha256(want))).some(Boolean) && want !== "invalid";
  return ok && order ? order : null;
}

type TrackedOrder = NonNullable<Awaited<ReturnType<typeof findOrderForTracking>>>;

export type PublicTrackingResult = {
  orderNumber: string;
  customerFirstName: string;
  createdAt: string;
  totalCents: number;
  paymentMethod: string;
  statusLabel: string;
  paid: boolean;
  delivered: boolean;
  etaText: string;
  items: { name: string; quantity: number }[];
  events: PublicTrackingEvent[];
};

export async function toPublicTracking(order: TrackedOrder, settings: Settings): Promise<PublicTrackingResult> {
  const { events, delivered } = await publicTimeline(order, settings);
  const paid = Boolean(trackingStart(order));
  return {
    orderNumber: order.orderNumber!,
    customerFirstName: order.customer.name.split(/\s+/)[0],
    createdAt: order.createdAt.toISOString(),
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod === "CREDIARIO" ? settings.crediario_method_label || PAYMENT_METHOD_LABEL.CREDIARIO : PAYMENT_METHOD_LABEL.PIX,
    statusLabel: delivered ? "Entregue" : paid ? (events.filter((e) => e.done).at(-1)?.title ?? "Pagamento concluído") : (ORDER_STATUS_LABEL[order.status] ?? order.status),
    paid,
    delivered,
    etaText: settings.shipping_eta_text || "Entrega estimada em 3 a 5 dias úteis",
    items: order.items.map((i) => ({ name: i.unitsPerOffer > 1 ? `${i.productName} — ${i.offerName}` : i.productName, quantity: i.quantity * i.unitsPerOffer })),
    events,
  };
}
