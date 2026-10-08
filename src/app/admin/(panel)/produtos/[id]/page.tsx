/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Field, PageHeader, inputCls, textareaCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { IconItemsEditor, ImageField, SpecsEditor, VideoInput } from "@/components/admin/inputs";
import { centsToInput } from "@/server/admin/forms";
import { db } from "@/lib/db";
import { addProductImage, deleteProductImage, moveProductImage, saveProduct, updateProductImage } from "../../catalog-actions";

export const metadata = { title: "Produto" };
const ROLE_LABEL = { MAIN: "Principal", SECONDARY: "Secundária", GALLERY: "Galeria" } as const;
const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = id === "novo" ? null : await db.product.findUnique({ where: { id }, include: { images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } });
  if (id !== "novo" && !p) notFound();
  const small = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50";

  return (
    <div className="space-y-6">
      <PageHeader title={p ? p.name : "Novo produto"} actions={<><Link href="/admin/produtos" className={btnSecondary}>Voltar</Link>{p && <Link href="/admin/ofertas" className={btnSecondary}>Ofertas deste produto</Link>}</>} />
      <ActionForm action={saveProduct} className="space-y-6">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Card title="Dados do produto">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4" /> Ativo (à venda)</label>
            <Field label="Nome"><input name="name" required defaultValue={p?.name ?? ""} className={inputCls} /></Field>
            <Field label="Nome curto" hint="Usado no checkout e resumos"><input name="shortName" defaultValue={p?.shortName ?? ""} className={inputCls} /></Field>
            <Field label="Slug"><input name="slug" defaultValue={p?.slug ?? ""} className={inputCls} /></Field>
            <Field label="SKU"><input name="sku" defaultValue={p?.sku ?? ""} className={inputCls} /></Field>
            <Field label="Descrição curta" className="md:col-span-2"><textarea name="shortDescription" rows={2} defaultValue={p?.shortDescription ?? ""} className={textareaCls} /></Field>
            <Field label="Descrição completa" className="md:col-span-2"><textarea name="description" rows={5} defaultValue={p?.description ?? ""} className={textareaCls} /></Field>
            <Field label="Preço unitário de referência (R$)" hint="O preço de venda de cada kit fica em Ofertas"><input name="price" required inputMode="decimal" defaultValue={centsToInput(p?.priceCents)} className={inputCls} /></Field>
            <Field label="Preço antigo (R$)" hint="Só preencha se for um preço realmente praticado antes"><input name="compareAtPrice" inputMode="decimal" defaultValue={centsToInput(p?.compareAtPriceCents)} className={inputCls} /></Field>
            <Field label="Texto de desconto" hint="Vazio = calculado"><input name="discountLabel" defaultValue={p?.discountLabel ?? ""} className={inputCls} /></Field>
            <Field label="Estoque (unidades)" hint="Vazio = sem controle. É baixado quando a venda é confirmada."><input name="stockQuantity" inputMode="numeric" defaultValue={p?.stockQuantity ?? ""} className={inputCls} /></Field>
            <Field label="Selo"><input name="badge" defaultValue={p?.badge ?? ""} className={inputCls} /></Field>
            <div className="md:col-span-2"><VideoInput name="videoUrl" label="Vídeo do produto (usado na demonstração se a seção não tiver vídeo próprio)" defaultValue={p?.videoUrl} /></div>
          </div>
        </Card>
        <Card title="Benefícios">
          <IconItemsEditor name="benefits" defaultValue={arr(p?.benefits)} />
        </Card>
        <Card title="Informações adicionais">
          <p className="mb-2 text-xs text-slate-500">Ex.: Conteúdo — 30 mL · Indicação — Mãos e unhas · Uso — Externo. Use somente informações verdadeiras do rótulo.</p>
          <SpecsEditor name="specs" defaultValue={arr(p?.specs)} />
        </Card>
        <Card title="SEO do produto">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título"><input name="seoTitle" maxLength={70} defaultValue={p?.seoTitle ?? ""} className={inputCls} /></Field>
            <Field label="Descrição"><input name="seoDescription" maxLength={170} defaultValue={p?.seoDescription ?? ""} className={inputCls} /></Field>
          </div>
        </Card>
        <SubmitButton>{p ? "Salvar produto" : "Criar produto"}</SubmitButton>
      </ActionForm>

      {p && (
        <Card title={`Imagens (${p.images.length})`}>
          <p className="mb-4 text-sm text-slate-600">A imagem <b>principal</b> aparece na primeira tela, nas ofertas e no checkout; a <b>secundária</b> na seção de solução. Envie do computador, escolha da biblioteca ou cole um link.</p>
          <ul className="space-y-3">
            {p.images.map((img, i) => (
              <li key={img.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <a href={img.url} target="_blank" rel="noopener noreferrer"><img src={img.url} alt={img.alt} className="h-24 w-24 rounded-lg bg-white object-contain" /></a>
                <ActionForm action={updateProductImage} className="grid min-w-[240px] flex-1 gap-2 sm:grid-cols-[140px_1fr]">
                  <input type="hidden" name="id" value={img.id} />
                  <select name="role" defaultValue={img.role} className={inputCls} aria-label="Tipo">
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="alt" defaultValue={img.alt} placeholder="Texto alternativo (acessibilidade)" className={inputCls} />
                  <div className="sm:col-span-2"><ImageField name="url" label="Substituir imagem" defaultValue={img.url} category="PRODUTO" /></div>
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <SubmitButton className={small}>Salvar</SubmitButton>
                    <Badge tone={img.role === "MAIN" ? "green" : img.role === "SECONDARY" ? "blue" : "slate"}>{ROLE_LABEL[img.role]}</Badge>
                  </div>
                </ActionForm>
                <div className="flex flex-col gap-1">
                  <form action={moveProductImage}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="dir" value="up" /><button className={small} disabled={i === 0} aria-label="Subir">↑</button></form>
                  <form action={moveProductImage}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="dir" value="down" /><button className={small} disabled={i === p.images.length - 1} aria-label="Descer">↓</button></form>
                  <ConfirmAction action={deleteProductImage} label="Excluir" danger hidden={{ id: img.id }} description="A imagem sai do produto (continua na biblioteca de Imagens)." />
                </div>
              </li>
            ))}
          </ul>
          <ActionForm action={addProductImage} resetOnSuccess className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-[1fr_160px_1fr]">
            <input type="hidden" name="productId" value={p.id} />
            <ImageField name="url" label="Nova imagem" category="PRODUTO" />
            <Field label="Tipo">
              <select name="role" defaultValue={p.images.some((x) => x.role === "MAIN") ? "GALLERY" : "MAIN"} className={inputCls}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Texto alternativo"><input name="alt" className={inputCls} /></Field>
            <div className="md:col-span-3"><SubmitButton>Adicionar imagem</SubmitButton></div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
