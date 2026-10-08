import Link from "next/link";
import { Badge, Card, Field, PageHeader, inputCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/inputs";
import { centsToInput } from "@/server/admin/forms";
import { offerDiscountLabel } from "@/lib/pricing";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/utils/format";
import { deleteOffer, saveOffer } from "../catalog-actions";

export const metadata = { title: "Ofertas" };
type Offer = Awaited<ReturnType<typeof db.productOffer.findMany>>[number];

function OfferForm({ o, products }: { o: Offer | null; products: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveOffer} resetOnSuccess={!o} className="grid gap-3 md:grid-cols-4">
      {o && <input type="hidden" name="id" value={o.id} />}
      <Field label="Nome" className="md:col-span-2"><input name="name" required defaultValue={o?.name ?? ""} placeholder="Kit com 2 unidades" className={inputCls} /></Field>
      <Field label="Produto">
        <select name="productId" defaultValue={o?.productId ?? products[0]?.id} className={inputCls}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Quantidade (unidades)"><input name="quantity" type="number" min={1} defaultValue={o?.quantity ?? 1} className={inputCls} /></Field>
      <Field label="Preço (R$)"><input name="price" required inputMode="decimal" defaultValue={centsToInput(o?.priceCents)} className={inputCls} /></Field>
      <Field label="Preço antigo (R$)" hint="Riscado — só se for um preço real"><input name="compareAtPrice" inputMode="decimal" defaultValue={centsToInput(o?.compareAtPriceCents)} className={inputCls} /></Field>
      <Field label="Texto de desconto" hint="Vazio = calculado (ex.: -17%)"><input name="discountLabel" defaultValue={o?.discountLabel ?? ""} className={inputCls} /></Field>
      <Field label="Selo / badge" hint="Ex.: Recomendado"><input name="badge" defaultValue={o?.badge ?? ""} className={inputCls} /></Field>
      <Field label="Descrição" className="md:col-span-2"><input name="description" defaultValue={o?.description ?? ""} className={inputCls} /></Field>
      <Field label="Slug (link do checkout)"><input name="slug" defaultValue={o?.slug ?? ""} className={inputCls} /></Field>
      <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={o?.sortOrder ?? 0} className={inputCls} /></Field>
      <div className="md:col-span-4"><ImageField name="imageUrl" label="Imagem da oferta (opcional — padrão: imagem principal do produto)" defaultValue={o?.imageUrl ?? ""} category="OFERTAS" /></div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-4">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={o?.active ?? true} className="h-4 w-4" /> Ativa</label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="highlight" defaultChecked={o?.highlight ?? false} className="h-4 w-4" /> Destaque (borda azul — só uma por produto)</label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="confirmBadge" className="h-4 w-4" /> Confirmo que o selo é verdadeiro (ex.: &quot;Mais vendido&quot; com dados de vendas)</label>
      </div>
      <div className="md:col-span-4"><SubmitButton>{o ? "Salvar oferta" : "Criar oferta"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function OffersPage() {
  const [offers, products, history] = await Promise.all([
    db.productOffer.findMany({ include: { _count: { select: { orderItems: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.product.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.priceHistory.findMany({ include: { offer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Ofertas e kits" description="Preço, preço antigo, desconto, selo, destaque, ordem e status. A landing e o checkout usam estes valores na hora." actions={<Link href="/#ofertas" target="_blank" className={btnSecondary}>Ver na landing</Link>} />
      {offers.map((o) => (
        <Card
          key={o.id}
          title={`${o.name} · ${formatBRL(o.priceCents)}${offerDiscountLabel(o) ? ` (${offerDiscountLabel(o)})` : ""}`}
          actions={<span className="flex items-center gap-2">{o.highlight && <Badge tone="blue">destaque</Badge>}{o.active ? <Badge tone="green">ativa</Badge> : <Badge>inativa</Badge>}<span className="text-xs text-slate-500">{o._count.orderItems} pedido(s)</span></span>}
        >
          <OfferForm o={o} products={products} />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <ConfirmAction action={deleteOffer} label="Remover" danger hidden={{ id: o.id }} description="Ofertas com pedidos são apenas desativadas, para preservar o histórico." />
            <span className="text-xs text-slate-500">Link direto do checkout: <code className="rounded bg-slate-100 px-1">/checkout?oferta={o.slug}</code></span>
          </div>
        </Card>
      ))}
      <Card title="Nova oferta"><OfferForm o={null} products={products} /></Card>
      {history.length > 0 && (
        <Card title="Histórico de preços">
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-xs text-slate-400">{formatDate(h.createdAt, true)}</span> · {h.offer.name}: {h.oldPriceCents != null ? `${formatBRL(h.oldPriceCents)} → ` : ""}<b>{formatBRL(h.newPriceCents)}</b>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
