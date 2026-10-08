/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Badge, PageHeader, btnPrimary } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { db } from "@/lib/db";
import { formatBRL } from "@/utils/format";

export const metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const products = await db.product.findMany({ include: { images: { where: { role: "MAIN" }, take: 1 }, _count: { select: { offers: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div>
      <PageHeader title="Produtos" description="A landing vende o primeiro produto ativo. Kits e preços de venda ficam em Ofertas." actions={<Link href="/admin/produtos/novo" className={btnPrimary}>Novo produto</Link>} />
      <Table
        rows={products}
        rowKey={(p) => p.id}
        empty="Nenhum produto."
        columns={[
          { key: "i", label: "", render: (p) => (p.images[0] ? <img src={p.images[0].url} alt="" className="h-12 w-12 rounded-lg bg-slate-100 object-contain" /> : <span className="block h-12 w-12 rounded-lg bg-slate-100" />) },
          { key: "n", label: "Produto", render: (p) => <Link href={`/admin/produtos/${p.id}`} className="font-semibold hover:underline">{p.name}</Link> },
          { key: "s", label: "SKU", render: (p) => p.sku },
          { key: "p", label: "Preço unitário", align: "right", render: (p) => formatBRL(p.priceCents) },
          { key: "o", label: "Ofertas", align: "right", render: (p) => p._count.offers },
          { key: "e", label: "Estoque", align: "right", render: (p) => p.stockQuantity ?? "sem controle" },
          { key: "a", label: "Status", render: (p) => (p.active ? <Badge tone="green">ativo</Badge> : <Badge>inativo</Badge>) },
        ]}
      />
    </div>
  );
}
