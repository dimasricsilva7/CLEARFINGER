"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { inputCls, labelCls, textareaCls } from "@/components/admin/ui";
import { CrediarioFields, EMPTY_CREDIARIO, type CrediarioValue } from "@/components/checkout/CrediarioFields";
import { crediarioConfig, VALIDITY_FORMATS } from "@/lib/crediario";
import { formatBRL } from "@/utils/format";
import { saveSettings } from "../../sistema-actions";

type Def = { key: string; label: string; type?: "text" | "textarea" | "number" | "check" | "format"; hint?: string };
const GROUPS: { title: string; fields: Def[] }[] = [
  {
    title: "Status e apresentação",
    fields: [
      { key: "crediario_enabled", label: "Crediário ativo no checkout", type: "check" },
      { key: "crediario_method_label", label: "Nome do método", hint: "Ex.: Crediário, Pagamento por Protocolo" },
      { key: "crediario_method_subtitle", label: "Texto abaixo do nome (opção de pagamento)", hint: "{parcelas} = máximo de parcelas. Ex.: Em até {parcelas}x · com o protocolo do seu crediário" },
      { key: "crediario_section_title", label: "Título da seção" },
      { key: "crediario_description", label: "Descrição", type: "textarea" },
    ],
  },
  {
    title: "Campo do protocolo",
    fields: [
      { key: "crediario_protocol_label", label: "Título" },
      { key: "crediario_protocol_placeholder", label: "Placeholder" },
      { key: "crediario_protocol_digits", label: "Quantidade de dígitos (limite de caracteres)", type: "number" },
      { key: "crediario_protocol_help", label: "Texto auxiliar" },
      { key: "crediario_protocol_error", label: "Mensagem de erro", hint: "{n} = quantidade de dígitos" },
    ],
  },
  {
    title: "Validade",
    fields: [
      { key: "crediario_validity_label", label: "Título" },
      { key: "crediario_validity_placeholder", label: "Placeholder" },
      { key: "crediario_validity_format", label: "Formato", type: "format" },
      { key: "crediario_validity_error", label: "Mensagem de erro (formato)", hint: "{formato} = formato configurado" },
      { key: "crediario_validity_expired_error", label: "Mensagem de erro (vencido)" },
      { key: "crediario_validity_reject_expired", label: "Recusar protocolo com validade vencida", type: "check" },
    ],
  },
  {
    title: "Últimos dígitos do CPF",
    fields: [
      { key: "crediario_cpf_label", label: "Título" },
      { key: "crediario_cpf_placeholder", label: "Placeholder" },
      { key: "crediario_cpf_digits", label: "Quantidade de dígitos", type: "number" },
      { key: "crediario_cpf_error", label: "Mensagem de erro", hint: "{n} = quantidade de dígitos" },
    ],
  },
  {
    title: "Parcelamento",
    fields: [
      { key: "crediario_installments_label", label: "Título" },
      { key: "crediario_installments_description", label: "Descrição" },
      { key: "crediario_max_installments", label: "Quantidade máxima de parcelas", type: "number" },
      { key: "crediario_installment_text", label: "Texto da opção", hint: "{n} = parcelas · {valor} = valor da parcela · {total} = total" },
    ],
  },
  {
    title: "Mensagens e botão",
    fields: [
      { key: "crediario_help_text", label: "Texto auxiliar", type: "textarea" },
      { key: "crediario_info_message", label: "Mensagem de informação" },
      { key: "crediario_error_message", label: "Mensagem de erro geral" },
      { key: "crediario_success_title", label: "Título de sucesso (página do pedido)" },
      { key: "crediario_success_message", label: "Mensagem de sucesso", type: "textarea" },
      { key: "crediario_button_label", label: "Texto do botão" },
      { key: "crediario_security_text", label: "Texto de segurança", type: "textarea" },
    ],
  },
];

export function CrediarioEditor({ initial, sampleTotalCents }: { initial: Record<string, string>; sampleTotalCents: number }) {
  const [s, setS] = useState(initial);
  const [preview, setPreview] = useState<CrediarioValue>(EMPTY_CREDIARIO);
  const cfg = crediarioConfig(s);
  const keys = GROUPS.flatMap((g) => g.fields.map((f) => f.key));
  const set = (k: string, v: string) => setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <ActionForm action={saveSettings} className="space-y-6">
        <input type="hidden" name="__keys" value={keys.join(",")} />
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-900">{g.title}</h2></header>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {g.fields.map((f) =>
                f.type === "check" ? (
                  <label key={f.key} className="flex items-center gap-2 text-sm font-medium md:col-span-2">
                    <input type="checkbox" name={f.key} checked={s[f.key] === "true"} onChange={(e) => set(f.key, String(e.target.checked))} className="h-4 w-4" />
                    {f.label}
                  </label>
                ) : (
                  <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                    <label className={labelCls} htmlFor={f.key}>{f.label}</label>
                    {f.type === "textarea" ? (
                      <textarea id={f.key} name={f.key} rows={2} value={s[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={textareaCls} />
                    ) : f.type === "format" ? (
                      <select id={f.key} name={f.key} value={s[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                        {VALIDITY_FORMATS.map((v) => <option key={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input id={f.key} name={f.key} type={f.type === "number" ? "number" : "text"} value={s[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
                    )}
                    {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
                  </div>
                )
              )}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-1 py-3 backdrop-blur">
          <SubmitButton>Salvar crediário</SubmitButton>
          <span className="text-xs text-slate-500">As alterações aparecem no checkout na hora, sem deploy.</span>
        </div>
      </ActionForm>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prévia no checkout (total de exemplo {formatBRL(sampleTotalCents)})</p>
        <div className="rounded-2xl border border-slate-200 bg-[#F5F8FC] p-4">
          {!cfg.enabled && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Crediário desativado — não aparece no checkout.</p>}
          <div className="rounded-[1.25rem] border border-line bg-white p-4">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary bg-primary/[0.05] p-3 ring-1 ring-primary">
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-primary"><span className="h-2.5 w-2.5 rounded-full bg-primary" /></span>
              <span>
                <span className="block font-bold text-navy">{cfg.methodLabel}</span>
                <span className="block text-sm text-muted">{cfg.methodSubtitle}</span>
              </span>
            </div>
            <CrediarioFields cfg={cfg} totalCents={sampleTotalCents} value={preview} onChange={(v) => setPreview(v)} />
            <button type="button" className="btn-primary mt-4 w-full">{cfg.buttonLabel}</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">A prévia é interativa (pode digitar para testar a máscara). Nada é enviado.</p>
      </aside>
    </div>
  );
}
