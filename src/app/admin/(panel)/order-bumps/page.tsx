import Link from "next/link";
import { Badge, Card, Field, PageHeader, inputCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/inputs";
import { centsToInput } from "@/server/admin/forms";
import { db } from "@/lib/db";
import { formatBRL } from "@/utils/format";
import { deleteBump, saveBump } from "../catalog-actions";

export const metadata = { title: "Order bumps" };
type Bump = Awaited<ReturnType<typeof db.orderBump.findMany>>[number];

function BumpForm({ b, products }: { b: Bump | null; products: { id: string; name: string; active: boolean }[] }) {
  return (
    <ActionForm action={saveBump} resetOnSuccess={!b} className="grid gap-3 md:grid-cols-4">
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Produto do order bump" className="md:col-span-2" hint="Crie outros produtos em Produtos para oferecê-los aqui">
        <select name="productId" defaultValue={b?.productId ?? products[0]?.id} className={inputCls}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inativo)"}</option>)}
        </select>
      </Field>
      <Field label="Unidades do produto"><input name="quantity" type="number" min={1} defaultValue={b?.quantity ?? 1} className={inputCls} /></Field>
      <Field label="Nome interno"><input name="name" defaultValue={b?.name ?? ""} className={inputCls} /></Field>
      <Field label="Título no checkout" className="md:col-span-2"><input name="title" required defaultValue={b?.title ?? ""} placeholder="Leve +1 frasco com desconto" className={inputCls} /></Field>
      <Field label="Preço (R$)"><input name="price" required inputMode="decimal" defaultValue={centsToInput(b?.priceCents)} className={inputCls} /></Field>
      <Field label="Preço antigo (R$)" hint="Riscado — só se for real"><input name="compareAtPrice" inputMode="decimal" defaultValue={centsToInput(b?.compareAtPriceCents)} className={inputCls} /></Field>
      <Field label="Descrição" className="md:col-span-3"><input name="description" defaultValue={b?.description ?? ""} className={inputCls} /></Field>
      <Field label="Selo" hint="Ex.: Oferta do checkout"><input name="badge" defaultValue={b?.badge ?? ""} className={inputCls} /></Field>
      <div className="md:col-span-4"><ImageField name="imageUrl" label="Imagem (opcional — padrão: imagem principal do produto)" defaultValue={b?.imageUrl ?? ""} category="OFERTAS" /></div>
      <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className={inputCls} /></Field>
      <label className="flex items-center gap-2 pt-5 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="h-4 w-4" /> Ativo no checkout</label>
      <div className="md:col-span-4"><SubmitButton>{b ? "Salvar order bump" : "Criar order bump"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function BumpsPage() {
  const [bumps, products, sold] = await Promise.all([
    db.orderBump.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.product.findMany({ select: { id: true, name: true, active: true }, orderBy: { createdAt: "asc" } }),
    db.orderItem.groupBy({ by: ["bumpId"], where: { kind: "ORDER_BUMP", order: { status: { in: ["PAID", "CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"] } } }, _count: true, _sum: { totalPriceCents: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Order bump"
        description="&quot;Adicione também ao seu pedido&quot;: ofertas que o cliente marca no checkout para adicionar ao pedido (desmarcadas por padrão). Produto, textos, preço e imagem editáveis."
        actions={<Link href="/admin/produtos/novo" className={btnSecondary}>Novo produto</Link>}
      />
      {bumps.map((b) => {
        const s = sold.find((x) => x.bumpId === b.id);
        return (
          <Card key={b.id} title={`${b.title} · ${formatBRL(b.priceCents)}`} actions={<span className="flex items-center gap-2">{b.active ? <Badge tone="green">ativo</Badge> : <Badge>inativo</Badge>}<span className="text-xs text-slate-500">{s?._count ?? 0} venda(s) · {formatBRL(s?._sum.totalPriceCents ?? 0)}</span></span>}>
            <BumpForm b={b} products={products} />
            <div className="mt-3 border-t border-slate-100 pt-3"><ConfirmAction action={deleteBump} label="Remover" danger hidden={{ id: b.id }} description="Order bumps já vendidos são apenas desativados." /></div>
          </Card>
        );
      })}
      <Card title="Novo order bump"><BumpForm b={null} products={products} /></Card>
    </div>
  );
}
