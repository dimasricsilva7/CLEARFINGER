import { NextResponse, after, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { ensurePix, findOrderByAccess, renewPix, syncOrder, toPublicOrder } from "@/server/orders";
import { maybeReconcileOpportunistically } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Polling da página do pedido. `force=1` ("Já paguei") apenas antecipa a consulta
 * ao gateway — o navegador nunca consegue marcar um pedido como pago.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`status:${ip}`, 40, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const sp = req.nextUrl.searchParams;
  let order = await findOrderByAccess(sp.get("pedido"), sp.get("t"));
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (order.status === "PENDING" || order.status === "PIX_GENERATED") {
    if (!order.pixCopyPaste && sp.get("retry") === "1") await ensurePix(order.id).catch(() => null);
    else await syncOrder(order, { minIntervalMs: sp.get("force") === "1" ? 3000 : 8000, source: "poll" });
    order = (await findOrderByAccess(sp.get("pedido"), sp.get("t")))!;
  }
  after(() => maybeReconcileOpportunistically());
  return NextResponse.json(toPublicOrder(order), { headers: { "Cache-Control": "no-store" } });
}

/** "Gerar novo PIX": o PIX anterior expirou. POST para links de e-mail/scanners nunca criarem cobranças. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`renew:${ip}`, 6, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { pedido?: string; t?: string };
  const order = await findOrderByAccess(body.pedido ?? null, body.t ?? null);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const renewed = await renewPix(order.id).catch(() => null);
  if (!renewed) return NextResponse.json({ error: "Não foi possível gerar um novo PIX agora. Tente novamente." }, { status: 502 });
  const fresh = (await findOrderByAccess(body.pedido ?? null, body.t ?? null))!;
  return NextResponse.json(toPublicOrder(fresh), { headers: { "Cache-Control": "no-store" } });
}
