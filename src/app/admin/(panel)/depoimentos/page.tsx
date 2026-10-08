import { Badge, Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/inputs";
import { db } from "@/lib/db";
import { deleteTestimonial, saveTestimonial } from "../cms-actions";

export const metadata = { title: "Depoimentos" };
type T = Awaited<ReturnType<typeof db.testimonial.findMany>>[number];

function TestimonialForm({ t }: { t: T | null }) {
  return (
    <ActionForm action={saveTestimonial} resetOnSuccess={!t} className="grid gap-3 md:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <Field label="Nome"><input name="name" required defaultValue={t?.name ?? ""} className={inputCls} /></Field>
      <Field label="Cidade (opcional)"><input name="city" defaultValue={t?.city ?? ""} placeholder="Ex.: Campinas/SP" className={inputCls} /></Field>
      <Field label="Texto" className="md:col-span-2"><textarea name="text" required rows={3} defaultValue={t?.text ?? ""} className={textareaCls} /></Field>
      <Field label="Nota (1–5)"><input name="rating" type="number" min={1} max={5} defaultValue={t?.rating ?? 5} className={inputCls} /></Field>
      <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={t?.sortOrder ?? 0} className={inputCls} /></Field>
      <div className="md:col-span-2"><ImageField name="avatarUrl" label="Avatar / foto (opcional)" defaultValue={t?.avatarUrl ?? ""} category="DEPOIMENTOS" /></div>
      <div className="space-y-2 md:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={t?.active ?? false} className="h-4 w-4" /> Ativo (publicar na landing)</label>
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          <input type="checkbox" name="confirmReal" defaultChecked={t?.active ?? false} className="mt-0.5 h-4 w-4" />
          Confirmo que este depoimento é real, de um cliente, e que tenho autorização para publicá-lo (com foto, se houver).
        </label>
      </div>
      <div className="md:col-span-2"><SubmitButton>{t ? "Salvar" : "Cadastrar depoimento"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function TestimonialsPage() {
  const list = await db.testimonial.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="Depoimentos" description="Somente depoimentos reais de clientes, com autorização. A seção aparece na landing quando houver pelo menos um ativo." />
      <Card title="Novo depoimento"><TestimonialForm t={null} /></Card>
      {list.map((t) => (
        <Card key={t.id} title={`${t.name} · ${"★".repeat(t.rating)}`} actions={t.active ? <Badge tone="green">ativo</Badge> : <Badge>inativo</Badge>}>
          <TestimonialForm t={t} />
          <div className="mt-3 border-t border-slate-100 pt-3"><ConfirmAction action={deleteTestimonial} label="Remover" danger hidden={{ id: t.id }} /></div>
        </Card>
      ))}
    </div>
  );
}
