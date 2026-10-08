import { NextResponse, type NextRequest } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { log } from "@/lib/log";
import { CheckoutError, createCheckoutOrder } from "@/server/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cria o pedido (PIX ou CREDIÁRIO). Dados do crediário nunca vão para URL, logs ou plataformas de anúncio. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`checkout:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ error: "Confira os dados informados.", fields }, { status: 422 });
  }
  const vid = req.cookies.get("cf_vid")?.value;
  const input = vid ? { ...parsed.data, context: { ...parsed.data.context, visitorId: vid } } : parsed.data;

  try {
    const { order } = await createCheckoutOrder(input, { ip, userAgent: req.headers.get("user-agent"), host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") });
    return NextResponse.json({ orderNumber: order.orderNumber, token: order.accessToken, status: order.status, method: order.paymentMethod, totalCents: order.totalCents });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
    log.error("checkout", "erro inesperado", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Não conseguimos concluir o pedido agora. Tente novamente." }, { status: 500 });
  }
}
