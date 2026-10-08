import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, PageHeader, Pagination, ORDER_TONE, inputCls, btnPrimary } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { RowActions } from "@/components/admin/RowActions";
import { CREDIARIO_STATUSES, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PIX_STATUSES } from "@/lib/domain";
import { db } from "@/lib/db";
import { formatBRL, formatDate, formatPhone } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { deleteOrder } from "./actions";

export const metadata = { title: "Pedidos" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const PER_PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const p = resolvePeriod({ periodo: "30d", ...sp });
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const method = sp.metodo === "PIX" || sp.metodo === "CREDIARIO" ? sp.metodo : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: p.from, lt: p.to },
    ...(method ? { paymentMethod: method } : {}),
    ...(status && status in ORDER_STATUS_LABEL ? { status: status as keyof typeof ORDER_STATUS_LABEL } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { email: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q.replace(/\D/g, "") || q } } },
            { utmCampaign: { contains: q, mode: "insensitive" } },
            ...(/^\d{4}$/.test(q) ? [{ crediario: { protocolLast4: q } }] : []),
          ],
        }
      : {}),
  };
  const [orders, count, byMethod] = await Promise.all([
    db.order.findMany({ where, include: { customer: true, items: { select: { offerName: true, quantity: true, unitsPerOffer: true } }, crediario: { select: { installments: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["paymentMethod"], where: { createdAt: { gte: p.from, lt: p.to } }, _count: true }),
  ]);
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "page")) as Record<string, string>;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...keep, ...extra }).toString();
  const statuses = method === "PIX" ? PIX_STATUSES : method === "CREDIARIO" ? CREDIARIO_STATUSES : (Object.keys(ORDER_STATUS_LABEL) as (keyof typeof ORDER_STATUS_LABEL)[]);
  const tab = (m: string, label: string) => {
    const n = m ? byMethod.find((b) => b.paymentMethod === m)?._count ?? 0 : byMethod.reduce((s, b) => s + b._count, 0);
    const { metodo: _m, status: _s, ...rest } = keep;
    return <Link href={`?${new URLSearchParams({ ...rest, ...(m ? { metodo: m } : {}) })}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${method === m ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{label} ({n})</Link>;
  };

  return (
    <div>
      <PageHeader title="Pedidos" description={`${count} pedido(s) · ${p.label}`} actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />} />
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Método de pagamento">
        {tab("", "Todos")}
        {tab("PIX", "PIX")}
        {tab("CREDIARIO", "Crediário")}
      </nav>
      <form className="mb-4 flex flex-wrap gap-2">
        {["periodo", "de", "ate", "metodo"].map((k) => typeof sp[k] === "string" && <input key={k} type="hidden" name={k} value={sp[k] as string} />)}
        <input name="q" defaultValue={q} placeholder="Nº, cliente, e-mail, telefone, campanha ou 4 últimos do protocolo" className={`${inputCls} max-w-md`} />
        <select name="status" defaultValue={status} className={`${inputCls} w-auto`} aria-label="Status">
          <option value="">Todos os status</option>
          {statuses.map((k) => <option key={k} value={k}>{ORDER_STATUS_LABEL[k]}</option>)}
        </select>
        <button className={btnPrimary}>Filtrar</button>
      </form>
      <Table
        rows={orders}
        rowKey={(o) => o.id}
        empty="Nenhum pedido encontrado."
        columns={[
          {
            key: "id",
            label: "Pedido · data",
            render: (o) => (
              <div className="whitespace-nowrap">
                <Link href={`/admin/pedidos/${o.id}`} className="font-semibold underline-offset-2 hover:underline">{o.orderNumber}</Link>
                <span className="block text-xs text-slate-500">{formatDate(o.createdAt, true)}</span>
              </div>
            ),
          },
          { key: "c", label: "Cliente", render: (o) => <div><span className="block">{o.customer.name}</span><span className="block text-xs text-slate-500">{formatPhone(o.customer.phone)}</span></div> },
          { key: "p", label: "Oferta", render: (o) => <span className="block max-w-[180px] truncate">{o.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.offerName}`).join(", ")}</span> },
          { key: "q", label: "Unid.", align: "right", render: (o) => o.items.reduce((s, i) => s + i.quantity * i.unitsPerOffer, 0) },
          { key: "v", label: "Total", align: "right", render: (o) => formatBRL(o.totalCents) },
          { key: "m", label: "Método", render: (o) => <Badge tone={o.paymentMethod === "PIX" ? "slate" : "blue"}>{PAYMENT_METHOD_LABEL[o.paymentMethod]}{o.crediario ? ` ${o.crediario.installments}x` : ""}</Badge> },
          { key: "s", label: "Status", render: (o) => <Badge tone={ORDER_TONE[o.status] ?? "slate"}>{ORDER_STATUS_LABEL[o.status]}</Badge> },
          { key: "o", label: "Origem", render: (o) => o.utmSource ?? o.channel ?? "—" },
          { key: "cp", label: "Campanha", render: (o) => <span className="block max-w-[160px] truncate">{o.utmCampaign ?? "—"}</span> },
          { key: "a", label: "", render: (o) => <RowActions id={o.id} onDelete={deleteOrder} deleteConfirm={`Excluir o pedido ${o.orderNumber} definitivamente?`} /> },
        ]}
      />
      <Pagination page={page} pages={Math.ceil(count / PER_PAGE)} makeHref={(pg) => `?${qs({ page: String(pg) })}`} />
    </div>
  );
}
