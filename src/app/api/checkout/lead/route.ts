import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { checkoutLeadSchema, logLeadError, upsertCheckoutLead } from "@/server/checkout-leads";

export const dynamic = "force-dynamic";

/** Salva o contato digitado no checkout (para recuperar a compra se a pessoa sair). */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "origem" }, { status: 403 });
  if (!rateLimit(`lead:${getClientIp(req.headers)}`, 30, 10 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = checkoutLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });
  try {
    const lead = await upsertCheckoutLead(parsed.data, { userAgent: req.headers.get("user-agent") });
    return NextResponse.json({ ok: true, saved: Boolean(lead) });
  } catch (err) {
    logLeadError("falha ao salvar checkout", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
