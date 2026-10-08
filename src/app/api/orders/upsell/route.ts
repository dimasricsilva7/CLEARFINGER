import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { log } from "@/lib/log";
import { acceptUpsell, CheckoutError, findOrderByAccess, recordUpsellEvent, upsellForOrder } from "@/server/orders";

export const dynamic = "force-dynamic";

/** Upsell pós-compra: view / accept / decline. Aceitar cria um pedido PIX novo; o pedido original nunca é alterado. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`upsell:${ip}`, 20, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { pedido?: string; t?: string; upsellId?: string; action?: string };
  const order = await findOrderByAccess(body.pedido ?? null, body.t ?? null);
  if (!order || !body.upsellId) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const offer = await upsellForOrder(order);
  if (!offer || offer.id !== body.upsellId) return NextResponse.json({ error: "Esta oferta não está mais disponível." }, { status: 409 });

  if (body.action === "view" || body.action === "decline") {
    await recordUpsellEvent(offer.id, order.id, body.action === "view" ? "VIEW" : "DECLINE");
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "accept") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  try {
    const child = await acceptUpsell(order, offer.id);
    return NextResponse.json({ orderNumber: child.orderNumber, t: child.accessToken });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("upsell", "falha ao aceitar upsell", { order: order.orderNumber, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Não foi possível adicionar agora. Seu pedido original continua confirmado." }, { status: 500 });
  }
}
