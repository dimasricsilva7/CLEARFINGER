import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader, Pagination, inputCls, btnPrimary } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { PAID_STATUSES } from "@/lib/domain";
import { db } from "@/lib/db";
import { formatBRL, formatDate, formatPhone } from "@/utils/format";

export const metadata = { title: "Clientes" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const PER_PAGE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.CustomerWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] }
    : {};
  const [customers, count] = await Promise.all([
    db.customer.findMany({
      where,
      include: { orders: { select: { status: true, totalCents: true, paidAmountCents: true, createdAt: true, utmSource: true, channel: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.customer.count({ where }),
  ]);
  const rows = customers.map((c) => {
    const paid = c.orders.filter((o) => (PAID_STATUSES as readonly string[]).includes(o.status));
    return { ...c, paidCount: paid.length, total: paid.reduce((s, o) => s + (o.paidAmountCents ?? o.totalCents), 0), last: c.orders[0]?.createdAt ?? null, origin: c.orders.at(-1)?.utmSource ?? c.orders.at(-1)?.channel ?? "—" };
  });
  return (
    <div>
      <PageHeader title="Clientes" description={`${count} cliente(s)`} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar nome, e-mail ou telefone" className={`${inputCls} max-w-sm`} />
        <button className={btnPrimary}>Buscar</button>
      </form>
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        empty="Nenhum cliente encontrado."
        columns={[
          { key: "n", label: "Nome", render: (r) => (<div><Link href={`/admin/clientes/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><span className="block whitespace-nowrap text-xs text-slate-500">desde {formatDate(r.createdAt, true)}</span></div>) },
          { key: "l", label: "Último pedido", render: (r) => <span className="whitespace-nowrap">{r.last ? formatDate(r.last, true) : "—"}</span> },
          { key: "t", label: "Telefone", render: (r) => formatPhone(r.phone) },
          { key: "e", label: "E-mail", render: (r) => r.email },
          { key: "o", label: "Pedidos", align: "right", render: (r) => `${r.paidCount} pago(s) / ${r.orders.length}` },
          { key: "v", label: "Valor total", align: "right", render: (r) => formatBRL(r.total) },
          { key: "s", label: "Origem (1º pedido)", render: (r) => r.origin },
        ]}
      />
      <Pagination page={page} pages={Math.ceil(count / PER_PAGE)} makeHref={(p) => `?${new URLSearchParams({ q, page: String(p) })}`} />
    </div>
  );
}
