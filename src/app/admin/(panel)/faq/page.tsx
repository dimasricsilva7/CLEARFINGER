import { Badge, Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { db } from "@/lib/db";
import { deleteFaq, saveFaq } from "../cms-actions";

export const metadata = { title: "FAQ" };
type Faq = Awaited<ReturnType<typeof db.faq.findMany>>[number];

function FaqForm({ f }: { f: Faq | null }) {
  return (
    <ActionForm action={saveFaq} resetOnSuccess={!f}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Pergunta"><input name="question" required defaultValue={f?.question ?? ""} className={inputCls} /></Field>
      <Field label="Resposta" hint="Links: [texto](/caminho) ou [texto](#secao)"><textarea name="answer" required rows={3} defaultValue={f?.answer ?? ""} className={textareaCls} /></Field>
      <div className="flex flex-wrap items-center gap-4">
        <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} className={`${inputCls} w-24`} /></Field>
        <label className="flex items-center gap-2 pt-4 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={f?.active ?? true} className="h-4 w-4" /> Publicada</label>
      </div>
      <SubmitButton>{f ? "Salvar" : "Adicionar pergunta"}</SubmitButton>
    </ActionForm>
  );
}

export default async function FaqAdminPage() {
  const faqs = await db.faq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="FAQ" description="Perguntas com [PREENCHER] dependem de dados da operação e só podem ser publicadas depois de completas." />
      {faqs.map((f) => (
        <Card key={f.id} title={`${f.sortOrder}. ${f.question}`} actions={f.active ? <Badge tone="green">publicada</Badge> : f.answer.includes("[PREENCHER]") ? <Badge tone="amber">preencher</Badge> : <Badge>oculta</Badge>}>
          <FaqForm f={f} />
          <div className="mt-3 border-t border-slate-100 pt-3"><ConfirmAction action={deleteFaq} label="Remover" danger hidden={{ id: f.id }} /></div>
        </Card>
      ))}
      <Card title="Nova pergunta"><FaqForm f={null} /></Card>
    </div>
  );
}
