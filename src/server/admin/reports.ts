import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FUNNEL_STEPS, PAID_STATUSES } from "@/lib/domain";
import { dayKeys, toDayKey, type Period } from "./period";

const PAID = [...PAID_STATUSES] as ("PAID" | "CREDIARIO_APROVADO" | "CREDIARIO_CONCLUIDO")[];
const n = (v: unknown) => Number(v ?? 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const revenueOf = (o: { paidAmountCents: number | null; totalCents: number }) => o.paidAmountCents ?? o.totalCents;
/** Data da venda confirmada: PIX pago (paidAt) ou crediário aprovado (approvedAt). */
const soldAt = (o: { paidAt: Date | null; approvedAt: Date | null }) => o.paidAt ?? o.approvedAt;

async function eventSessions(p: Period, names: string[]) {
  const rows = await db.$queryRaw<{ day: string; c: bigint }[]>`
    SELECT to_char("createdAt" - interval '3 hours', 'YYYY-MM-DD') AS day, COUNT(DISTINCT "sessionId") c
    FROM "TrackingEvent" WHERE name IN (${Prisma.join(names)}) AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, n(r.c)]));
}

// ───────────────────────── Dashboard ─────────────────────────

export async function dashboard(p: Period) {
  const range = { gte: p.from, lt: p.to };
  const [visitorsRow, created, sold, pixPendingNow, visitorsDay, checkoutDay] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT "visitorId") c FROM "VisitorSession" WHERE "firstSeenAt" >= ${p.from} AND "firstSeenAt" < ${p.to} AND COALESCE(device,'') <> 'servidor'`,
    db.order.findMany({ where: { createdAt: range }, select: { id: true, status: true, paymentMethod: true, transactionId: true, totalCents: true, createdAt: true } }),
    db.order.findMany({
      where: { status: { in: PAID }, OR: [{ paidAt: range }, { approvedAt: range }] },
      select: { id: true, paymentMethod: true, paidAt: true, approvedAt: true, totalCents: true, paidAmountCents: true, channel: true, utmCampaign: true, device: true, items: { select: { offerName: true, quantity: true, totalPriceCents: true } } },
    }),
    db.order.count({ where: { status: "PIX_GENERATED" } }),
    db.$queryRaw<{ day: string; c: bigint }[]>`SELECT to_char("firstSeenAt" - interval '3 hours', 'YYYY-MM-DD') AS day, COUNT(DISTINCT "visitorId") c FROM "VisitorSession" WHERE "firstSeenAt" >= ${p.from} AND "firstSeenAt" < ${p.to} AND COALESCE(device,'') <> 'servidor' GROUP BY 1`,
    eventSessions(p, ["checkout_started"]),
  ]);

  const visitors = n(visitorsRow[0]?.c);
  const revenue = sold.reduce((s, o) => s + revenueOf(o), 0);
  const pix = created.filter((o) => o.paymentMethod === "PIX");
  const cred = created.filter((o) => o.paymentMethod === "CREDIARIO");
  const soldPix = sold.filter((o) => o.paymentMethod === "PIX");
  const soldCred = sold.filter((o) => o.paymentMethod === "CREDIARIO");
  const count = (list: typeof created, s: string) => list.filter((o) => o.status === s).length;

  const vMap = new Map(visitorsDay.map((r) => [r.day, n(r.c)]));
  const byDay = new Map(dayKeys(p).map((d) => [d, { revenue: 0, sold: 0, pixOrders: 0, credOrders: 0, pixPaid: 0, credApproved: 0 }]));
  for (const o of sold) {
    const row = byDay.get(toDayKey(soldAt(o)!));
    if (!row) continue;
    row.revenue += revenueOf(o);
    row.sold += 1;
    if (o.paymentMethod === "PIX") row.pixPaid += 1;
    else row.credApproved += 1;
  }
  for (const o of created) {
    const row = byDay.get(toDayKey(o.createdAt));
    if (!row) continue;
    if (o.paymentMethod === "PIX") row.pixOrders += 1;
    else row.credOrders += 1;
  }
  const days = [...byDay.entries()];

  const group = (key: (o: (typeof sold)[number]) => string) => {
    const m = new Map<string, { value: number; count: number }>();
    for (const o of sold) {
      const k = key(o) || "—";
      const r = m.get(k) ?? { value: 0, count: 0 };
      r.value += revenueOf(o);
      r.count += 1;
      m.set(k, r);
    }
    return [...m.entries()].map(([label, r]) => ({ label, value: r.value, sub: `${r.count} venda(s)` })).sort((a, b) => b.value - a.value);
  };

  return {
    visitors,
    orders: created.length,
    sold: sold.length,
    revenue,
    aov: ratio(revenue, sold.length),
    conversion: ratio(sold.length, visitors),
    pix: {
      orders: pix.length,
      generated: pix.filter((o) => o.transactionId).length,
      pending: count(pix, "PIX_GENERATED") + count(pix, "PENDING"),
      paid: soldPix.length,
      expired: count(pix, "EXPIRED"),
      revenue: soldPix.reduce((s, o) => s + revenueOf(o), 0),
      paymentRate: ratio(pix.filter((o) => o.status === "PAID").length, pix.filter((o) => o.transactionId).length),
      pendingNow: pixPendingNow,
    },
    crediario: {
      orders: cred.length,
      pending: count(cred, "CREDIARIO_PENDENTE"),
      review: count(cred, "CREDIARIO_EM_ANALISE"),
      approved: soldCred.length,
      rejected: count(cred, "CREDIARIO_RECUSADO"),
      cancelled: count(cred, "CREDIARIO_CANCELADO"),
      revenue: soldCred.reduce((s, o) => s + revenueOf(o), 0),
      approvalRate: ratio(cred.filter((o) => o.status === "CREDIARIO_APROVADO" || o.status === "CREDIARIO_CONCLUIDO").length, cred.length),
    },
    daily: {
      revenue: days.map(([day, r]) => ({ day, values: [r.revenue] })),
      sales: days.map(([day, r]) => ({ day, values: [r.sold] })),
      visitors: days.map(([day]) => ({ day, values: [vMap.get(day) ?? 0, checkoutDay.get(day) ?? 0] })),
      methods: days.map(([day, r]) => ({ day, values: [r.pixOrders, r.credOrders] })),
      confirmed: days.map(([day, r]) => ({ day, values: [r.pixPaid, r.credApproved] })),
      conversion: days.map(([day, r]) => ({ day, values: [Math.round(ratio(r.sold, vMap.get(day) ?? 0) * 10000)] })),
    },
    byOffer: (() => {
      const m = new Map<string, { value: number; units: number }>();
      for (const o of sold) for (const i of o.items) {
        const r = m.get(i.offerName) ?? { value: 0, units: 0 };
        r.value += i.totalPriceCents;
        r.units += i.quantity;
        m.set(i.offerName, r);
      }
      return [...m.entries()].map(([label, r]) => ({ label, value: r.value, sub: `${r.units} venda(s)` })).sort((a, b) => b.value - a.value);
    })(),
    byChannel: group((o) => o.channel ?? "direto"),
    byCampaign: group((o) => o.utmCampaign ?? "(sem campanha)").slice(0, 10),
    byDevice: group((o) => o.device ?? "—"),
  };
}

// ───────────────────────── Métricas de pagamento ─────────────────────────

export async function paymentMetrics(p: Period) {
  const count = async (names: string[]) => {
    const r = await db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT "sessionId") c FROM "TrackingEvent" WHERE name IN (${Prisma.join(names)}) AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to}`;
    return n(r[0]?.c);
  };
  const range = { gte: p.from, lt: p.to };
  const [pixGenerated, pixCopied, credStarted, credProtocol, credData, credInstallment, orders] = await Promise.all([
    db.order.count({ where: { paymentMethod: "PIX", transactionId: { not: null }, createdAt: range } }),
    count(["pix_copied"]),
    count(["crediario_started"]),
    count(["crediario_protocol_completed"]),
    count(["crediario_data_completed"]),
    count(["crediario_installment_selected"]),
    db.order.groupBy({ by: ["paymentMethod", "status"], where: { createdAt: range }, _count: true, _sum: { totalCents: true } }),
  ]);
  const st = (m: string, s: string) => orders.find((o) => o.paymentMethod === m && o.status === s)?._count ?? 0;
  const sum = (m: string, ss: string[]) => orders.filter((o) => o.paymentMethod === m && ss.includes(o.status)).reduce((a, o) => a + (o._sum.totalCents ?? 0), 0);
  const credOrders = orders.filter((o) => o.paymentMethod === "CREDIARIO").reduce((a, o) => a + o._count, 0);
  const credApproved = st("CREDIARIO", "CREDIARIO_APROVADO") + st("CREDIARIO", "CREDIARIO_CONCLUIDO");
  return {
    pix: {
      generated: pixGenerated,
      copied: pixCopied,
      paid: st("PIX", "PAID"),
      expired: st("PIX", "EXPIRED"),
      pending: st("PIX", "PIX_GENERATED") + st("PIX", "PENDING"),
      failed: st("PIX", "FAILED"),
      paymentRate: ratio(st("PIX", "PAID"), pixGenerated),
      revenue: sum("PIX", ["PAID"]),
    },
    crediario: {
      started: credStarted,
      protocolCompleted: credProtocol,
      dataCompleted: credData,
      installmentSelected: credInstallment,
      orders: credOrders,
      pending: st("CREDIARIO", "CREDIARIO_PENDENTE"),
      review: st("CREDIARIO", "CREDIARIO_EM_ANALISE"),
      approved: credApproved,
      rejected: st("CREDIARIO", "CREDIARIO_RECUSADO"),
      cancelled: st("CREDIARIO", "CREDIARIO_CANCELADO"),
      completed: st("CREDIARIO", "CREDIARIO_CONCLUIDO"),
      startToOrder: ratio(credOrders, credStarted),
      approvalRate: ratio(credApproved, credOrders),
      revenue: sum("CREDIARIO", ["CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"]),
    },
  };
}

// ───────────────────────── Funil ─────────────────────────

export type FunnelFilters = { source?: string; campaign?: string; device?: string; method?: string };

function sessionFilter(f: FunnelFilters, p: Period) {
  const parts: Prisma.Sql[] = [];
  if (f.source) parts.push(Prisma.sql`(s."utmSource" = ${f.source} OR s.channel = ${f.source})`);
  if (f.campaign) parts.push(Prisma.sql`s."utmCampaign" = ${f.campaign}`);
  if (f.device) parts.push(Prisma.sql`s.device = ${f.device}`);
  if (f.method === "PIX") parts.push(Prisma.sql`e."sessionId" NOT IN (SELECT "sessionId" FROM "TrackingEvent" WHERE name = 'crediario_started' AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to})`);
  if (f.method === "CREDIARIO") parts.push(Prisma.sql`e."sessionId" IN (SELECT "sessionId" FROM "TrackingEvent" WHERE name = 'crediario_started' AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to})`);
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, " AND ")}` : Prisma.empty;
}

const funnelCols = () => FUNNEL_STEPS.map((s, i) => Prisma.sql`COUNT(DISTINCT e."sessionId") FILTER (WHERE e.name IN (${Prisma.join(s.events)})) AS ${Prisma.raw(`s${i}`)}`);

/**
 * Funil por sessão. Eventos de servidor (pedido, compra) são ligados à sessão do navegador
 * quando o pedido carrega o session_id — por isso o mesmo visitante atravessa todas as etapas.
 */
export async function funnel(p: Period, f: FunnelFilters = {}) {
  const rows = await db.$queryRaw<Record<string, bigint>[]>`
    SELECT ${Prisma.join(funnelCols())},
           COALESCE(SUM(e."valueCents") FILTER (WHERE e.name = 'purchase'), 0) AS revenue
    FROM "TrackingEvent" e JOIN "VisitorSession" s ON s.id = e."sessionId"
    WHERE e."createdAt" >= ${p.from} AND e."createdAt" < ${p.to} ${sessionFilter(f, p)}`;
  const r = rows[0] ?? {};
  const steps = FUNNEL_STEPS.map((s, i) => ({ key: s.key, label: s.label, value: n(r[`s${i}`]) }));
  const first = steps[0]?.value ?? 0;
  return {
    steps: steps.map((s, i) => ({ ...s, pctOfFirst: ratio(s.value, first), fromPrev: i ? ratio(s.value, steps[i - 1].value) : 1 })),
    revenue: n(r.revenue),
    conversion: ratio(steps.at(-1)?.value ?? 0, first),
  };
}

export async function funnelByDay(p: Period, f: FunnelFilters = {}) {
  const rows = await db.$queryRaw<Record<string, bigint | string>[]>`
    SELECT to_char(e."createdAt" - interval '3 hours', 'YYYY-MM-DD') AS day, ${Prisma.join(funnelCols())},
           COALESCE(SUM(e."valueCents") FILTER (WHERE e.name = 'purchase'), 0) AS revenue
    FROM "TrackingEvent" e JOIN "VisitorSession" s ON s.id = e."sessionId"
    WHERE e."createdAt" >= ${p.from} AND e."createdAt" < ${p.to} ${sessionFilter(f, p)}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [String(r.day), r]));
  return dayKeys(p)
    .reverse()
    .map((day) => {
      const r = byDay.get(day) ?? {};
      const values = FUNNEL_STEPS.map((_, i) => n(r[`s${i}`] as bigint | undefined));
      return { day, values, revenue: n(r.revenue as bigint | undefined), conversion: ratio(values.at(-1) ?? 0, values[0] ?? 0) };
    });
}

export async function funnelFilterOptions() {
  const [sources, campaigns, devices] = await Promise.all([
    db.visitorSession.findMany({ where: { utmSource: { not: null } }, distinct: ["utmSource"], select: { utmSource: true }, take: 50 }),
    db.visitorSession.findMany({ where: { utmCampaign: { not: null } }, distinct: ["utmCampaign"], select: { utmCampaign: true }, take: 100 }),
    db.visitorSession.findMany({ where: { device: { not: null } }, distinct: ["device"], select: { device: true } }),
  ]);
  return {
    sources: [...new Set(["facebook", "instagram", "google", "tiktok", ...sources.map((s) => s.utmSource!)])],
    campaigns: campaigns.map((c) => c.utmCampaign!),
    devices: devices.map((d) => d.device!).filter((d) => d !== "servidor"),
  };
}

// ───────────────────────── Aquisição (UTMs) ─────────────────────────

export const ACQ_DIMS = { utmSource: "Origem (utm_source)", utmMedium: "Mídia (utm_medium)", utmCampaign: "Campanha (utm_campaign)", utmContent: "Anúncio (utm_content)", utmTerm: "Conjunto (utm_term)", channel: "Canal", gclid: "gclid", fbclid: "fbclid" } as const;
export type AcqDim = keyof typeof ACQ_DIMS;

export async function acquisition(p: Period, dim: AcqDim) {
  const clickId = dim === "fbclid" || dim === "gclid";
  const col = Prisma.raw(`"${dim}"`);
  const keyExpr = clickId ? Prisma.sql`CASE WHEN ${col} IS NULL THEN 'sem ${Prisma.raw(dim)}' ELSE 'com ${Prisma.raw(dim)}' END` : Prisma.sql`COALESCE(${col}, '(não definido)')`;
  const [sess, ords] = await Promise.all([
    db.$queryRaw<{ k: string; visitors: bigint }[]>`
      SELECT ${keyExpr} k, COUNT(DISTINCT "visitorId") visitors FROM "VisitorSession"
      WHERE "firstSeenAt" >= ${p.from} AND "firstSeenAt" < ${p.to} AND COALESCE(device,'') <> 'servidor' GROUP BY 1`,
    db.$queryRaw<{ k: string; orders: bigint; pix: bigint; cred: bigint; sold: bigint; revenue: bigint }[]>`
      SELECT ${keyExpr} k, COUNT(*) orders,
             COUNT(*) FILTER (WHERE "paymentMethod" = 'PIX') pix,
             COUNT(*) FILTER (WHERE "paymentMethod" = 'CREDIARIO') cred,
             COUNT(*) FILTER (WHERE status IN ('PAID','CREDIARIO_APROVADO','CREDIARIO_CONCLUIDO')) sold,
             COALESCE(SUM(COALESCE("paidAmountCents","totalCents")) FILTER (WHERE status IN ('PAID','CREDIARIO_APROVADO','CREDIARIO_CONCLUIDO')),0) revenue
      FROM "Order" WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY 1`,
  ]);
  const keys = new Set([...sess.map((s) => s.k), ...ords.map((o) => o.k)]);
  return [...keys]
    .map((k) => {
      const s = sess.find((x) => x.k === k);
      const o = ords.find((x) => x.k === k);
      const visitors = n(s?.visitors);
      const sold = n(o?.sold);
      return { key: k, visitors, orders: n(o?.orders), pix: n(o?.pix), cred: n(o?.cred), sold, revenue: n(o?.revenue), conversion: ratio(sold, visitors) };
    })
    .sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
}
