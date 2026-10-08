import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { classifyChannel, parseUserAgent } from "@/utils/channel";
import type { TrackedEvent } from "@/lib/domain";
import type { Attribution } from "@/types/tracking";

export type SessionInit = {
  sessionId: string;
  visitorId: string;
  userAgent?: string | null;
  attribution?: Attribution | null;
  path?: string | null;
  siteHost?: string | null;
};

const cut = (v: string | null | undefined, n = 200) => (v ? String(v).slice(0, n) : null);

type SessionInfo = { id: string; created: boolean; device: string | null; utmSource: string | null; utmCampaign: string | null };

/** Cria a sessão no primeiro evento; nas seguintes, apenas devolve os dados de origem/dispositivo. */
export async function ensureSession(init: SessionInit): Promise<SessionInfo> {
  const existing = await db.visitorSession.findUnique({
    where: { id: init.sessionId },
    select: { id: true, device: true, utmSource: true, utmCampaign: true },
  });
  if (existing) {
    return { id: existing.id, created: false, device: existing.device, utmSource: existing.utmSource, utmCampaign: existing.utmCampaign };
  }
  const ua = parseUserAgent(init.userAgent);
  const a = init.attribution;
  const touch = a?.last ?? a?.first ?? null;
  const referrer = cut(a?.referrer, 500);
  const channel = classifyChannel({ source: touch?.source, medium: touch?.medium, fbclid: a?.fbclid, gclid: a?.gclid, ttclid: a?.ttclid, referrer, siteHost: init.siteHost });
  const data = {
    visitorId: init.visitorId,
    landingPage: cut(a?.landingPage ?? init.path, 500),
    exitPage: cut(init.path, 500),
    referrer,
    utmSource: cut(touch?.source),
    utmMedium: cut(touch?.medium),
    utmCampaign: cut(touch?.campaign),
    utmContent: cut(touch?.content),
    utmTerm: cut(touch?.term),
    fbclid: cut(a?.fbclid, 500),
    gclid: cut(a?.gclid, 500),
    ttclid: cut(a?.ttclid, 500),
    channel,
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
  };
  try {
    await db.visitorSession.upsert({ where: { id: init.sessionId }, update: {}, create: { id: init.sessionId, ...data } });
  } catch (err) {
    // Duas requisições simultâneas da mesma aba criando a sessão: a outra venceu — segue com a existente
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  return { id: init.sessionId, created: true, device: data.device, utmSource: data.utmSource, utmCampaign: data.utmCampaign };
}

export type EventInput = {
  sessionId: string;
  visitorId: string;
  name: TrackedEvent;
  path?: string | null;
  productId?: string | null;
  offerId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  element?: string | null;
  valueCents?: number | null;
  props?: Record<string, unknown> | null;
  device?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
};

export async function trackEvent(e: EventInput) {
  await db.trackingEvent.create({
    data: {
      sessionId: e.sessionId,
      visitorId: e.visitorId,
      name: e.name,
      path: cut(e.path, 500),
      productId: e.productId ?? null,
      offerId: e.offerId ?? null,
      orderId: e.orderId ?? null,
      customerId: e.customerId ?? null,
      element: cut(e.element, 80),
      valueCents: e.valueCents ?? null,
      props: (e.props ?? undefined) as Prisma.InputJsonValue,
      device: e.device ?? null,
      utmSource: e.utmSource ?? null,
      utmCampaign: e.utmCampaign ?? null,
    },
  });
}

export async function touchSession(sessionId: string, path: string | null | undefined, pageView: boolean) {
  await db.visitorSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date(), ...(path ? { exitPage: cut(path, 500) } : {}), ...(pageView ? { pageViews: { increment: 1 } } : {}) },
  });
}

type OrderRef = { id: string; sessionId: string | null; visitorId: string | null; customerId?: string | null; channel?: string | null; device?: string | null; utmSource?: string | null; utmCampaign?: string | null };

/** Eventos originados no servidor (checkout, webhook, jobs) — sempre ligados ao pedido. */
export async function trackServerEvent(order: OrderRef, name: TrackedEvent, extra: Omit<EventInput, "sessionId" | "visitorId" | "name"> = {}) {
  try {
    let sessionId = order.sessionId;
    const visitorId = order.visitorId ?? `order_${order.id}`;
    if (sessionId) {
      const exists = await db.visitorSession.findUnique({ where: { id: sessionId }, select: { id: true } });
      if (!exists) sessionId = null;
    }
    if (!sessionId) {
      sessionId = `srv_${order.id}`;
      await db.visitorSession.upsert({
        where: { id: sessionId },
        update: {},
        create: { id: sessionId, visitorId, channel: order.channel ?? "direto", device: order.device ?? "servidor", utmSource: order.utmSource ?? null, utmCampaign: order.utmCampaign ?? null },
      });
    }
    await trackEvent({
      sessionId,
      visitorId,
      name,
      orderId: order.id,
      customerId: order.customerId ?? null,
      device: order.device ?? null,
      utmSource: order.utmSource ?? null,
      utmCampaign: order.utmCampaign ?? null,
      ...extra,
    });
  } catch (err) {
    log.error("analytics", "falha ao registrar evento de servidor", { event: name, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Vincula a sessão anônima ao cliente (sem copiar dados pessoais para o analytics). */
export async function linkSessionToCustomer(sessionId: string | null | undefined, customerId: string) {
  if (!sessionId) return;
  await db.visitorSession.updateMany({ where: { id: sessionId }, data: { customerId } }).catch(() => {});
}
