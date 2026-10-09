import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { cancelScheduled } from "@/lib/email";
import { findOrderByAccess } from "@/server/orders";
import { findLeadByToken } from "@/server/checkout-leads";

export const dynamic = "force-dynamic";

const page = (title: string, body: string, form = "") =>
  new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;font-weight:500;background:#F5F8FC;font-family:system-ui,Arial,sans-serif;color:#0F1B2D"><div style="max-width:440px;margin:48px auto;padding:28px 24px;background:#fff;border:1px solid #E3EAF3;border-radius:24px;text-align:center">
<h1 style="font-size:22px;margin:0 0 10px">${title}</h1><p style="color:#5B6B80;line-height:1.5;margin:0">${body}</p>${form}
<p style="margin:20px 0 0"><a href="/" style="color:#1F6FD1;font-weight:700">Voltar à loja</a></p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

async function optOut(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lead = await findLeadByToken(sp.get("lead"));
  if (lead) {
    await db.checkoutLead.update({ where: { id: lead.id }, data: { emailOptOut: true, ...(lead.emailStatus === "SCHEDULED" ? { emailStatus: "CANCELLED", emailError: "Descadastrou" } : {}) } });
    if (lead.email) {
      await db.checkoutLead.updateMany({ where: { email: lead.email, emailStatus: "SCHEDULED" }, data: { emailStatus: "CANCELLED", emailError: "Descadastrou" } });
      await db.customer.updateMany({ where: { email: lead.email }, data: { emailOptOutAt: new Date() } });
    }
    return true;
  }
  const order = await findOrderByAccess(sp.get("pedido"), sp.get("t"));
  if (!order) return false;
  await db.customer.update({ where: { id: order.customerId }, data: { emailOptOutAt: new Date() } });
  const orders = await db.order.findMany({ where: { customerId: order.customerId }, select: { id: true } });
  for (const o of orders) await cancelScheduled(o.id, "PIX_RECOVERY", "Cliente descadastrou");
  return true;
}

/** GET mostra a confirmação (scanners de link não descadastram ninguém sem querer). */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search.replace(/"/g, "");
  return page(
    "Parar lembretes de pagamento?",
    "Você deixará de receber lembretes sobre pedidos não pagos. O e-mail de confirmação de compra continua chegando normalmente.",
    `<form method="post" action="/api/email/unsubscribe${qs}" style="margin-top:20px"><button type="submit" style="background:#1F6FD1;color:#fff;border:0;border-radius:14px;padding:14px 22px;font-weight:800;font-size:15px;cursor:pointer">Sim, parar lembretes</button></form>`
  );
}

/** POST: botão da página ou one-click do Gmail/Yahoo (List-Unsubscribe-Post). */
export async function POST(req: NextRequest) {
  if (!rateLimit(`unsub:${getClientIp(req.headers)}`, 20, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const ok = await optOut(req);
  if (!ok) return page("Link inválido", "Não encontramos este pedido.");
  return page("Pronto!", "Você não receberá mais lembretes de pagamento. Se precisar, é só falar com a gente.");
}
