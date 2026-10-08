import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { hashIp } from "@/lib/crypto";
import { findOrderForTracking, normalizeOrderNumber, recordTrackingLookup, toPublicTracking, trackingLookupBlocked } from "@/server/delivery";
import { getSettingsFresh } from "@/server/settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  cpf: z.string().max(20).optional(),
  email: z.string().max(160).optional(),
});

const NOT_FOUND = "Não encontramos um pedido com esses dados. Confira o número do pedido e o CPF ou e-mail usados na compra.";

/** Consulta pública de rastreio: pedido + CPF ou pedido + e-mail. Resposta genérica para qualquer divergência. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`rastrear:${ip}`, 10, 5 * 60_000)) return NextResponse.json({ error: "Muitas consultas. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.cpf && !parsed.data.email)) return NextResponse.json({ error: "Informe o número do pedido e o CPF ou e-mail." }, { status: 422 });

  const ipKey = hashIp(ip) ?? "unknown";
  const orderNumber = normalizeOrderNumber(parsed.data.orderNumber);
  if (await trackingLookupBlocked(ipKey, orderNumber)) return NextResponse.json({ error: "Muitas consultas. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  const order = await findOrderForTracking(orderNumber, { cpf: parsed.data.cpf, email: parsed.data.email });
  await recordTrackingLookup(ipKey, orderNumber, Boolean(order));
  if (!order) {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250)); // atraso uniforme contra enumeração
    return NextResponse.json({ error: NOT_FOUND }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const settings = await getSettingsFresh();
  return NextResponse.json(await toPublicTracking(order, settings), { headers: { "Cache-Control": "no-store" } });
}
