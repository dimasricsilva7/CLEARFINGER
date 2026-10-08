import Link from "next/link";
import { Badge, PageHeader, Pagination } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { db } from "@/lib/db";
import { formatDate } from "@/utils/format";

export const metadata = { title: "Webhooks" };
const PER_PAGE = 50;

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [rows, count, failed] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.webhookEvent.count(),
    db.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);
  const orders = await db.order.findMany({ where: { id: { in: rows.map((r) => r.orderId).filter(Boolean) as string[] } }, select: { id: true, orderNumber: true } });
  return (
    <div>
      <PageHeader title="Webhooks BravoPay" description={`${count} recebido(s) · ${failed} com falha (reprocessados automaticamente pelo job)`} />
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        empty="Nenhum webhook recebido ainda."
        columns={[
          { key: "t", label: "Recebido", render: (r) => formatDate(r.receivedAt, true) },
          { key: "e", label: "Evento", render: (r) => <b className="font-medium">{r.eventType}</b> },
          { key: "id", label: "Event ID", render: (r) => <span className="font-mono text-xs">{r.eventId.slice(0, 28)}</span> },
          { key: "tx", label: "Transação", render: (r) => <span className="font-mono text-xs">{r.transactionId?.slice(0, 20) ?? "—"}</span> },
          {
            key: "o",
            label: "Pedido",
            render: (r) => {
              const o = orders.find((x) => x.id === r.orderId);
              return o ? <Link href={`/admin/pedidos/${o.id}`} className="underline">{o.orderNumber}</Link> : "—";
            },
          },
          { key: "st", label: "Status anterior → novo", render: (r) => (r.previousStatus ? `${r.previousStatus} → ${r.newStatus}` : "—") },
          { key: "r", label: "Resultado", render: (r) => r.result ?? r.error ?? "—" },
          { key: "a", label: "Tentativas", align: "right", render: (r) => r.attempts },
          { key: "s", label: "Processamento", render: (r) => <Badge tone={r.status === "PROCESSED" ? "green" : r.status === "FAILED" ? "red" : r.status === "IGNORED" ? "slate" : "amber"}>{r.status}</Badge> },
        ]}
      />
      <Pagination page={page} pages={Math.ceil(count / PER_PAGE)} makeHref={(p) => `?page=${p}`} />
    </div>
  );
}
