import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Stat, ORDER_TONE } from "@/components/admin/ui";
import { ORDER_STATUS_LABEL, PAID_STATUSES, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { db } from "@/lib/db";
import { formatBRL, formatDate, formatPhone, maskCpfForList } from "@/utils/format";

export const metadata = { title: "Cliente" };
const RELEVANT = ["offer_selected", "checkout_started", "payment_method_selected", "pix_generated", "pix_copied", "crediario_order_created", "crediario_approved", "crediario_rejected", "order_created", "purchase", "payment_expired"];

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, include: { orders: { include: { items: { select: { productName: true, offerName: true, quantity: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  const sessionIds = c.orders.map((o) => o.sessionId).filter(Boolean) as string[];
  const events = await db.trackingEvent.findMany({
    where: { name: { in: RELEVANT }, OR: [{ customerId: c.id }, { orderId: { in: c.orders.map((o) => o.id) } }, { sessionId: { in: sessionIds } }] },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const paid = c.orders.filter((o) => (PAID_STATUSES as readonly string[]).includes(o.status));
  const total = paid.reduce((s, o) => s + (o.paidAmountCents ?? o.totalCents), 0);
  const products = [...new Set(paid.flatMap((o) => o.items.map((i) => i.offerName)))];
  const first = c.orders.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title={c.name} description={`Cliente desde ${formatDate(c.createdAt)}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pedidos" value={`${paid.length} / ${c.orders.length}`} hint="pagos / total" />
        <Stat label="Valor total" value={formatBRL(total)} />
        <Stat label="Último pedido" value={c.orders[0] ? formatDate(c.orders[0].createdAt) : "—"} />
        <Stat label="Origem" value={first?.utmSource ?? first?.channel ?? "—"} hint={first?.utmCampaign ?? undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Contato">
          <dl className="space-y-1.5 text-sm">
            <div><dt className="inline text-slate-500">E-mail: </dt><dd className="inline">{c.email}</dd></div>
            <div><dt className="inline text-slate-500">Telefone: </dt><dd className="inline">{formatPhone(c.phone)}</dd></div>
            {c.cpf && <div><dt className="inline text-slate-500">CPF: </dt><dd className="inline">{maskCpfForList(c.cpf)}</dd></div>}
            <div><dt className="inline text-slate-500">Opt-in de marketing: </dt><dd className="inline">{c.marketingConsent ? "sim" : "não"}</dd></div>
          </dl>
          {products.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Produtos comprados</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{products.map((p) => <li key={p}><Badge>{p}</Badge></li>)}</ul>
            </>
          )}
        </Card>
        <Card title="Pedidos">
          <ul className="divide-y divide-slate-100 text-sm">
            {c.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">{o.orderNumber}</Link>
                <span className="text-slate-500">{formatDate(o.createdAt, true)}</span>
                <span className="max-w-[240px] truncate text-slate-600">{o.items.map((i) => `${i.quantity}× ${i.offerName}`).join(", ")}</span>
                <span className="tabular-nums">{formatBRL(o.totalCents)}</span>
                <span className="flex gap-1"><Badge tone="slate">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</Badge><Badge tone={ORDER_TONE[o.status] ?? "slate"}>{ORDER_STATUS_LABEL[o.status]}</Badge></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Eventos relevantes">
        {events.length ? (
          <ol className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-32 shrink-0 text-xs text-slate-400">{formatDate(e.createdAt, true)}</span>
                <b className="font-medium">{e.name}</b>
                {e.valueCents != null && <span className="text-slate-500">{formatBRL(e.valueCents)}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Nenhum evento registrado.</p>
        )}
      </Card>
    </div>
  );
}
