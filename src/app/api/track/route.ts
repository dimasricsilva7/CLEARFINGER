import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { ensureSession, touchSession, trackEvent } from "@/lib/analytics";
import { sendCapiEvent, type CapiEventName } from "@/lib/meta/capi";
import { clientContextSchema } from "@/lib/validation";
import { TRACKED_EVENTS } from "@/lib/domain";
import { log } from "@/lib/log";
import { parseUserAgent } from "@/utils/channel";
import { maybeReconcileOpportunistically } from "@/server/jobs";

export const dynamic = "force-dynamic";

/** Eventos de navegador que podem ser espelhados na CAPI (Purchase NUNCA vem do navegador). */
const CAPI_ALLOWED: CapiEventName[] = ["PageView", "ViewContent", "InitiateCheckout"];
const idRe = /^[A-Za-z0-9_-]{8,64}$/;

const bodySchema = z.object({
  sid: z.string().regex(idRe),
  vid: z.string().regex(idRe),
  context: clientContextSchema.optional(),
  events: z
    .array(
      z.object({
        name: z.enum(TRACKED_EVENTS),
        path: z.string().max(500).optional(),
        productId: z.string().max(40).optional().nullable(),
        offerId: z.string().max(40).optional().nullable(),
        element: z.string().max(80).optional().nullable(),
        valueCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
        props: z.record(z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
        capi: z
          .object({ eventName: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead"]), eventId: z.string().max(80), url: z.string().max(1000), customData: z.record(z.unknown()).optional() })
          .optional(),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse(null, { status: 204 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`track:${ip}`, 150, 60_000)) return new NextResponse(null, { status: 204 });
  const userAgent = req.headers.get("user-agent");
  if (parseUserAgent(userAgent).isBot) return new NextResponse(null, { status: 204 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { sid, vid, events, context } = parsed.data;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  try {
    const session = await ensureSession({ sessionId: sid, visitorId: vid, userAgent, attribution: context?.attribution, path: events[0]?.path, siteHost: host });
    const hasPageView = events.some((e) => e.name === "page_view");
    await touchSession(sid, events.at(-1)?.path, hasPageView);
    for (const e of events) {
      await trackEvent({
        sessionId: sid,
        visitorId: vid,
        name: e.name,
        path: e.path,
        productId: e.productId,
        offerId: e.offerId,
        element: e.element,
        valueCents: e.valueCents,
        props: e.props,
        device: session.device,
        utmSource: session.utmSource,
        utmCampaign: session.utmCampaign,
      });
    }

    // Espelho CAPI somente com consentimento de marketing
    const capiEvents = context?.adsConsent ? events.filter((e) => e.capi && CAPI_ALLOWED.includes(e.capi.eventName)) : [];
    if (capiEvents.length) {
      after(async () => {
        for (const e of capiEvents) {
          await sendCapiEvent({
            eventName: e.capi!.eventName,
            eventId: e.capi!.eventId,
            eventSourceUrl: e.capi!.url,
            user: { ip, userAgent, fbp: context?.fbp, fbc: context?.fbc, externalId: vid },
            customData: e.capi!.customData,
          });
        }
      });
    }
  } catch (err) {
    log.error("track", "erro ao registrar eventos", { error: err instanceof Error ? err.message : String(err) });
  }
  // Tráfego do site também dispara (no máx. 1x/min por instância) a reconciliação de PIX pendentes
  after(() => maybeReconcileOpportunistically());
  return new NextResponse(null, { status: 204 });
}
