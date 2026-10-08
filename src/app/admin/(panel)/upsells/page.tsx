import Link from "next/link";
import { Badge, Card, Field, PageHeader, inputCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/inputs";
import { centsToInput } from "@/server/admin/forms";
import { db } from "@/lib/db";
import { formatBRL } from "@/utils/format";
import { deleteUpsell, saveUpsell } from "../catalog-actions";

export const metadata = { title: "Upsell" };
type Upsell = Awaited<ReturnType<typeof db.upsell.findMany>>[number];

const TRIGGERS = [
  ["ANY_CONFIRMED", "Após PIX pago ou crediário enviado"],
  ["PIX_PAID", "Somente após PIX pago"],
  ["CREDIARIO_CREATED", "Somente após pedido no crediário"],
] as const;

function UpsellForm({ u, products }: { u: Upsell | null; products: { id: string; name: string; active: boolean }[] }) {
  return (
    <ActionForm action={saveUpsell} resetOnSuccess={!u} className="grid gap-3 md:grid-cols-4">
      {u && <input type="hidden" name="id" value={u.id} />}
      <Field label="Produto oferecido" className="md:col-span-2" hint="Cadastre o produto em Produtos (imagem, descrição, preço)">
        <select name="productId" defaultValue={u?.productId ?? products[0]?.id} className={inputCls}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inativo)"}</option>)}
        </select>
      </Field>
      <Field label="Unidades"><input name="quantity" type="number" min={1} defaultValue={u?.quantity ?? 1} className={inputCls} /></Field>
      <Field label="Nome interno"><input name="name" defaultValue={u?.name ?? ""} className={inputCls} /></Field>
      <Field label="Título" className="md:col-span-2"><input name="title" required defaultValue={u?.title ?? ""} placeholder="Aproveite e leve também…" className={inputCls} /></Field>
      <Field label="Preço (R$)"><input name="price" required inputMode="decimal" defaultValue={centsToInput(u?.priceCents)} className={inputCls} /></Field>
      <Field label="Preço antigo (R$)" hint="Riscado — só se for real"><input name="compareAtPrice" inputMode="decimal" defaultValue={centsToInput(u?.compareAtPriceCents)} className={inputCls} /></Field>
      <Field label="Descrição" className="md:col-span-3"><input name="description" defaultValue={u?.description ?? ""} className={inputCls} /></Field>
      <Field label="Selo"><input name="badge" defaultValue={u?.badge ?? ""} placeholder="Oferta única" className={inputCls} /></Field>
      <Field label="Botão aceitar"><input name="acceptLabel" defaultValue={u?.acceptLabel ?? "Sim, quero adicionar"} className={inputCls} /></Field>
      <Field label="Botão recusar"><input name="declineLabel" defaultValue={u?.declineLabel ?? "Não, obrigado"} className={inputCls} /></Field>
      <Field label="Quando aparece">
        <select name="trigger" defaultValue={u?.trigger ?? "ANY_CONFIRMED"} className={inputCls}>
          {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Posição na página do pedido">
        <select name="position" defaultValue={u?.position ?? "TOP"} className={inputCls}>
          <option value="TOP">Topo (logo após a confirmação)</option>
          <option value="BOTTOM">Abaixo do resumo</option>
        </select>
      </Field>
      <div className="md:col-span-4"><ImageField name="imageUrl" label="Imagem (opcional — padrão: imagem principal do produto)" defaultValue={u?.imageUrl ?? ""} category="OFERTAS" /></div>
      <Field label="Ordem" hint="Aparece um upsell por pedido: o ativo de menor ordem"><input name="sortOrder" type="number" defaultValue={u?.sortOrder ?? 0} className={inputCls} /></Field>
      <label className="flex items-center gap-2 pt-5 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={u?.active ?? false} className="h-4 w-4" /> Ativo</label>
      <div className="md:col-span-4"><SubmitButton>{u ? "Salvar upsell" : "Criar upsell"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function UpsellsPage() {
  const [upsells, products, stats] = await Promise.all([
    db.upsell.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.product.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.upsellEvent.groupBy({ by: ["upsellId", "action"], _count: true }),
  ]);
  const count = (id: string, action: string) => stats.find((s) => s.upsellId === id && s.action === action)?._count ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upsell"
        description="Oferta exibida na página do pedido depois da compra. Aceitar gera um novo pedido PIX vinculado ao original; recusar só esconde a oferta — o pedido principal nunca é afetado."
        actions={<Link href="/admin/produtos/novo" className={btnSecondary}>Novo produto</Link>}
      />
      {upsells.map((u) => (
        <Card
          key={u.id}
          title={`${u.title} · ${formatBRL(u.priceCents)}`}
          actions={
            <span className="flex items-center gap-2">
              {u.active ? <Badge tone="green">ativo</Badge> : <Badge>inativo</Badge>}
              <span className="text-xs text-slate-500">{count(u.id, "VIEW")} exibições · {count(u.id, "ACCEPT")} aceites · {count(u.id, "DECLINE")} recusas</span>
            </span>
          }
        >
          <UpsellForm u={u} products={products} />
          <div className="mt-3 border-t border-slate-100 pt-3"><ConfirmAction action={deleteUpsell} label="Remover" danger hidden={{ id: u.id }} description="Upsells que já geraram pedidos são apenas desativados." /></div>
        </Card>
      ))}
      <Card title="Novo upsell"><UpsellForm u={null} products={products} /></Card>
    </div>
  );
}
