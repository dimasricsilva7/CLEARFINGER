import Link from "next/link";
import { Badge, Card, Field, PageHeader, inputCls, textareaCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { bravopayMode, siteUrl } from "@/lib/env";
import { getSettingsFresh } from "@/server/settings";
import { saveSettings } from "../sistema-actions";

export const metadata = { title: "Pagamentos" };

export default async function PaymentsPage() {
  const s = await getSettingsFresh();
  const mode = bravopayMode();
  const keys = ["pix_enabled", "pix_method_label", "pix_description", "pix_button_label", "pix_expiration_minutes"];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="PIX (BravoPay) e Crediário são métodos independentes: cada um pode ser ativado ou desativado sem afetar o outro."
        actions={<Link href="/admin/pagamentos/crediario" className={btnSecondary}>Crediário →</Link>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="PIX — BravoPay">
          <p className="text-sm">
            Gateway: {mode === "live" ? <Badge tone="green">produção (API real)</Badge> : mode === "mock" ? <Badge tone="amber">modo de teste (PIX fictício)</Badge> : <Badge tone="red">não configurado — PIX indisponível</Badge>}{" "}
            {s.pix_enabled === "true" ? <Badge tone="green">ativo no checkout</Badge> : <Badge>desativado</Badge>}
          </p>
          <p className="mt-3 text-sm text-slate-600">URL do webhook (cadastrar no painel BravoPay):</p>
          <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 text-xs">{siteUrl()}/api/webhooks/bravopay</code>
          <p className="mt-2 text-xs text-slate-500">Eventos: transaction.paid, expired, failed, refunded, chargeback. Assinatura HMAC-SHA256 obrigatória (BRAVOPAY_WEBHOOK_SECRET). O pedido só vira pago por confirmação do gateway (webhook, consulta ou reconciliação) — nunca pelo navegador.</p>
          <p className="mt-2 text-xs">Webhook secret: {process.env.BRAVOPAY_WEBHOOK_SECRET ? <Badge tone="green">configurado</Badge> : <Badge tone="red">ausente</Badge>}</p>
        </Card>
        <Card title="Crediário">
          <p className="text-sm">{s.crediario_enabled === "true" ? <Badge tone="green">ativo no checkout</Badge> : <Badge>desativado</Badge>} · nome exibido: <b>{s.crediario_method_label}</b> · até {s.crediario_max_installments}x</p>
          <p className="mt-3 text-sm text-slate-600">O cliente informa protocolo, validade, últimos dígitos do CPF e parcelas. O pedido entra como <b>Crediário pendente</b> e você aprova ou recusa na página do pedido.</p>
          <Link href="/admin/pagamentos/crediario" className={`${btnSecondary} mt-3`}>Editar campos e textos do crediário</Link>
        </Card>
      </div>
      <Card title="Configuração do PIX">
        <ActionForm action={saveSettings} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="__keys" value={keys.join(",")} />
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" name="pix_enabled" defaultChecked={s.pix_enabled === "true"} className="h-4 w-4" /> PIX ativo no checkout</label>
          <Field label="Nome do método"><input name="pix_method_label" defaultValue={s.pix_method_label} className={inputCls} /></Field>
          <Field label="Texto do botão"><input name="pix_button_label" defaultValue={s.pix_button_label} className={inputCls} /></Field>
          <Field label="Descrição" className="md:col-span-2"><textarea name="pix_description" rows={2} defaultValue={s.pix_description} className={textareaCls} /></Field>
          <Field label="Validade do PIX (minutos)"><input name="pix_expiration_minutes" inputMode="numeric" defaultValue={s.pix_expiration_minutes} className={inputCls} /></Field>
          <div className="md:col-span-2"><SubmitButton>Salvar PIX</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
