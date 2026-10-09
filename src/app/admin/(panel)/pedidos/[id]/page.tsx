import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Badge, Card, Field, PageHeader, ORDER_TONE, inputCls, textareaCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { CREDIARIO_TRANSITIONS, FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, isAwaitingPix, isPaidStatus, type CrediarioStatus } from "@/lib/domain";
import { bravopayMode, isProductionDeploy, siteUrl } from "@/lib/env";
import { decryptField } from "@/lib/crypto";
import { formatProtocol } from "@/lib/crediario";
import { db } from "@/lib/db";
import { formatBRL, formatCep, formatCpf, formatDate, formatPhone } from "@/utils/format";
import { addTrackingEvent, cancelOrder, deleteOrder, recheckPayment, setCrediarioStatus, simulatePayment, toggleTrackingEvent, updateFulfillment } from "../actions";
import { stageDefs } from "@/lib/delivery";
import { syncOrderTracking } from "@/server/delivery";
import { getSettingsFresh } from "@/server/settings";

export const metadata = { title: "Pedido" };

const Row = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
  <div className="flex flex-wrap gap-x-2">
    <dt className="text-slate-500">{k}:</dt>
    <dd className={mono ? "break-all font-mono text-xs leading-5" : ""}>{v || "—"}</dd>
  </div>
);

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, items: true, payments: true, paymentEvents: { orderBy: { createdAt: "asc" } }, crediario: true, utm: true },
  });
  if (!order) notFound();
  const settings = await getSettingsFresh();
  await syncOrderTracking(order, settings).catch(() => 0);
  const stages = stageDefs(settings);
  const tracking = await db.orderTrackingEvent.findMany({ where: { orderId: order.id }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] });
  const [webhooks, events] = await Promise.all([
    db.webhookEvent.findMany({ where: { OR: [{ orderId: order.id }, ...(order.transactionId ? [{ transactionId: order.transactionId }] : [])] }, orderBy: { receivedAt: "asc" } }),
    order.sessionId ? db.trackingEvent.findMany({ where: { sessionId: order.sessionId }, orderBy: { createdAt: "asc" }, take: 150, select: { id: true, name: true, element: true, path: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const addr = order.shippingAddress as { cep?: string; street?: string; number?: string; complement?: string | null; district?: string; city?: string; state?: string } | null;
  const snap = order.customerSnapshot as { name?: string; cpf?: string | null };
  const mock = bravopayMode() === "mock" && !isProductionDeploy();
  const isPix = order.paymentMethod === "PIX";
  const cred = order.crediario;
  // Dados do crediário completos para a equipe (cifrados no banco; nunca vão para Meta/Google/URL/logs)
  const cpfLast = cred ? decryptField(cred.cpfLast3Enc) : null;
  const protocol = cred ? decryptField(cred.protocolEnc) : null;
  const validity = cred ? decryptField(cred.validityEnc) : null;
  const qr = isPix && order.pixCopyPaste && isAwaitingPix(order.status) ? await QRCode.toString(order.pixCopyPaste, { type: "svg", margin: 1 }) : null;
  const nextCred = !isPix ? CREDIARIO_TRANSITIONS[order.status as CrediarioStatus] ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido ${order.orderNumber}`}
        description={`Criado em ${formatDate(order.createdAt, true)} · ${PAYMENT_METHOD_LABEL[order.paymentMethod]}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_TONE[order.status] ?? "slate"}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            <Link href="/admin/pedidos" className={btnSecondary}>Voltar</Link>
            <ConfirmAction action={deleteOrder} label="Excluir" confirmLabel="Excluir definitivamente" danger description={`O pedido ${order.orderNumber} será apagado com itens, pagamentos e eventos. Use para pedidos de teste ou duplicados.`} hidden={{ id: order.id, back: "1" }} />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {/* CREDIÁRIO */}
          {cred && (
            <Card title={`Crediário · ${cred.methodLabel}`}>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Row k="Protocolo" v={<span className="font-mono text-base font-semibold tracking-wider">{protocol ? formatProtocol(protocol) : <span className="text-red-600">não foi possível ler (chave de criptografia diferente)</span>}</span>} />
                <Row k="Validade" v={<span className="font-mono font-semibold">{validity ?? "—"}</span>} />
                <Row k={`Últimos ${cpfLast?.length ?? 3} dígitos do CPF`} v={<span className="font-mono font-semibold">{cpfLast ?? "—"}</span>} />
                {snap.cpf && <Row k="CPF completo (cadastro)" v={<span className="font-mono">{formatCpf(snap.cpf)}</span>} />}
                <Row k="Parcelas" v={`${cred.installments}x · ${cred.installmentLabel}`} />
                <Row k="Status" v={<Badge tone={ORDER_TONE[order.status] ?? "slate"}>{ORDER_STATUS_LABEL[order.status]}</Badge>} />
                {order.approvedAt && <Row k="Aprovado em" v={formatDate(order.approvedAt, true)} />}
                {order.rejectedAt && <Row k="Recusado em" v={formatDate(order.rejectedAt, true)} />}
                {cred.analysisNote && <Row k="Observação da análise" v={cred.analysisNote} />}
              </dl>
              <p className="mt-3 text-xs text-slate-500">Dados cifrados no banco (AES-256). Nunca são enviados ao Meta/Google, à URL ou aos logs.</p>
              {nextCred.length > 0 && (
                <ActionForm action={setCrediarioStatus} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[200px_1fr]">
                  <input type="hidden" name="id" value={order.id} />
                  <Field label="Novo status">
                    <select name="status" className={inputCls} defaultValue={nextCred[0]}>
                      {nextCred.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
                    </select>
                  </Field>
                  <Field label="Observação (opcional)"><input name="note" className={inputCls} placeholder="Ex.: aprovado pela financeira em 07/10" /></Field>
                  <div className="sm:col-span-2"><SubmitButton>Atualizar status do crediário</SubmitButton></div>
                </ActionForm>
              )}
            </Card>
          )}

          <Card title="Itens (snapshot da compra)">
            <ul className="divide-y divide-slate-100 text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5">
                  <div>
                    <p className="font-medium">{i.quantity}× {i.offerName}</p>
                    <p className="text-xs text-slate-500">{i.productName} · SKU {i.sku} · {i.unitsPerOffer * i.quantity} unidade(s){i.listPriceCents !== i.unitPriceCents ? ` · preço antigo ${formatBRL(i.listPriceCents)}` : ""}</p>
                  </div>
                  <p className="shrink-0 tabular-nums"><b>{formatBRL(i.totalPriceCents)}</b></p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatBRL(order.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Desconto</dt><dd>{order.discountCents ? `− ${formatBRL(order.discountCents)}` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Frete</dt><dd>{order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"}</dd></div>
              <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatBRL(order.totalCents)}</dd></div>
              {order.paidAmountCents != null && <div className="flex justify-between text-emerald-700"><dt>Pago</dt><dd>{formatBRL(order.paidAmountCents)}{order.feeCents != null && ` · taxa ${formatBRL(order.feeCents)} · líquido ${formatBRL(order.netCents ?? 0)}`}</dd></div>}
            </dl>
          </Card>

          {isPaidStatus(order.status) && (
            <Card title="Rastreio da entrega (visto pelo cliente)" actions={<Link href={`/rastrear-pedido?pedido=${order.orderNumber}`} target="_blank" className="text-xs font-semibold text-blue-700 underline">Abrir rastreio</Link>}>
              {tracking.length ? (
                <ol className="space-y-2 text-sm">
                  {tracking.map((e) => (
                    <li key={e.id} className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border p-2.5 ${e.hidden ? "border-dashed border-slate-300 bg-slate-50 opacity-60" : "border-slate-200"}`}>
                      <span className="w-32 shrink-0 text-xs text-slate-500">{formatDate(e.occurredAt, true)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {e.title} {e.automatic ? <Badge>automático</Badge> : <Badge tone="blue">manual</Badge>} {e.hidden && <Badge tone="amber">oculto</Badge>}
                        </p>
                        {e.description && <p className="text-xs text-slate-500">{e.description}</p>}
                        {(e.note || e.createdBy) && <p className="text-xs text-slate-400">{[e.createdBy, e.note].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <ActionForm action={toggleTrackingEvent}>
                        <input type="hidden" name="eventId" value={e.id} />
                        <button className="text-xs font-semibold text-slate-600 underline">{e.hidden ? "Reexibir" : "Ocultar (correção)"}</button>
                      </ActionForm>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">As etapas automáticas aparecem conforme os horários programados.</p>
              )}
              {!tracking.some((e) => e.status === "DELIVERED" && !e.hidden) && (
                <ActionForm action={addTrackingEvent} className="mt-3">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="DELIVERED" />
                  <SubmitButton>Marcar como entregue</SubmitButton>
                </ActionForm>
              )}
              <details className="mt-4 rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Adicionar atualização manual</summary>
                <ActionForm action={addTrackingEvent} resetOnSuccess className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={order.id} />
                  <Field label="Etapa">
                    <select name="status" defaultValue="NOTE" className={inputCls}>
                      <option value="NOTE">Atualização personalizada</option>
                      {stages.filter((d) => d.code !== "PAID").map((d) => <option key={d.code} value={d.code}>{d.title}</option>)}
                    </select>
                  </Field>
                  <Field label="Data e hora (Brasília)" hint="Vazio = agora"><input type="datetime-local" name="occurredAt" className={inputCls} /></Field>
                  <Field label="Título" hint="Vazio = título padrão da etapa" className="md:col-span-2"><input name="title" className={inputCls} /></Field>
                  <Field label="Descrição (visível ao cliente)" className="md:col-span-2"><textarea name="description" rows={2} className={textareaCls} /></Field>
                  <Field label="Observação interna" className="md:col-span-2"><input name="note" className={inputCls} /></Field>
                  <div className="md:col-span-2"><SubmitButton>Adicionar à linha do tempo</SubmitButton></div>
                </ActionForm>
              </details>
            </Card>
          )}

          <Card title="Histórico do pedido">
            <ol className="space-y-2 text-sm">
              {order.paymentEvents.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-32 shrink-0 text-xs text-slate-400">{formatDate(e.createdAt, true)}</span>
                  <span><b className="font-medium">{e.message}</b> <span className="text-xs text-slate-400">{e.type}</span></span>
                </li>
              ))}
            </ol>
          </Card>

          {isPix && (
            <Card title={`Webhooks (${webhooks.length})`}>
              {webhooks.length ? (
                <ul className="space-y-1 text-sm">
                  {webhooks.map((w) => (
                    <li key={w.id} className="flex flex-wrap gap-2">
                      <span className="text-xs text-slate-400">{formatDate(w.receivedAt, true)}</span>
                      <b className="font-medium">{w.eventType}</b>
                      <Badge tone={w.status === "PROCESSED" ? "green" : w.status === "FAILED" ? "red" : "slate"}>{w.status}</Badge>
                      <span className="text-xs text-slate-500">{w.previousStatus} → {w.newStatus} · {w.result} · {w.attempts} tentativa(s)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhum webhook recebido.</p>
              )}
            </Card>
          )}

          {events.length > 0 && (
            <Card title="Jornada da sessão (tracking próprio)">
              <ol className="max-h-80 space-y-1 overflow-y-auto text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="w-28 shrink-0 text-slate-400">{formatDate(e.createdAt, true)}</span>
                    <span className="font-medium">{e.name}</span>
                    <span className="truncate text-slate-500">{e.element ?? e.path}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Cliente">
            <dl className="space-y-1.5 text-sm">
              <Row k="Nome" v={<Link href={`/admin/clientes/${order.customerId}`} className="font-medium underline">{snap.name ?? order.customer.name}</Link>} />
              <Row k="E-mail" v={order.customer.email} />
              <Row k="Telefone" v={formatPhone(order.customer.phone)} />
              {snap.cpf && <Row k="CPF" v={formatCpf(snap.cpf)} />}
              <Row k="Opt-in marketing" v={order.customer.marketingConsent ? "sim" : "não"} />
            </dl>
            {addr && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm">
                {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}<br />
                {addr.district} · {addr.city}/{addr.state} · {addr.cep && formatCep(addr.cep)}
              </p>
            )}
          </Card>

          {isPix && (
            <Card title="Pagamento PIX">
              <dl className="space-y-1.5 text-sm">
                <Row k="Status PIX" v={<Badge tone={ORDER_TONE[order.status] ?? "slate"}>{ORDER_STATUS_LABEL[order.status]}</Badge>} />
                <Row k="Provedor" v={order.paymentProvider} />
                <Row k="Transaction ID" v={order.transactionId} mono />
                <Row k="Payment ID" v={order.payments.at(-1)?.id} mono />
                <Row k="Referência" v={order.externalReference} mono />
                <Row k="Gerado em" v={order.payments.at(-1) ? formatDate(order.payments.at(-1)!.createdAt, true) : null} />
                <Row k="Expira em" v={order.pixExpiresAt ? formatDate(order.pixExpiresAt, true) : null} />
                <Row k="Confirmado em" v={order.paidAt ? formatDate(order.paidAt, true) : null} />
                {order.paymentError && <div className="text-red-600">Último erro: {order.paymentError}</div>}
              </dl>
              {qr && <div className="mt-3 w-40 rounded-lg border border-slate-200 p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />}
              <div className="mt-4 flex flex-wrap gap-2">
                {order.transactionId && isAwaitingPix(order.status) && (
                  <ActionForm action={recheckPayment} className="contents">
                    <input type="hidden" name="id" value={order.id} />
                    <SubmitButton className={btnSecondary} pendingText="Consultando…">Consultar BravoPay</SubmitButton>
                  </ActionForm>
                )}
                {isAwaitingPix(order.status) && <ConfirmAction action={cancelOrder} label="Cancelar pedido" danger description="O PIX gerado deixará de ser considerado." hidden={{ id: order.id }} />}
                {mock && order.transactionId && isAwaitingPix(order.status) && <ConfirmAction action={simulatePayment} label="Simular pagamento (teste)" description="Envia um webhook assinado transaction.paid (somente modo de teste)." hidden={{ id: order.id }} />}
              </div>
              <p className="mt-3 text-xs text-slate-500">Reembolso: feito no painel BravoPay; o webhook transaction.refunded atualiza o pedido.</p>
            </Card>
          )}

          {isPaidStatus(order.status) && (
            <Card title="Entrega">
              <ActionForm action={updateFulfillment}>
                <input type="hidden" name="id" value={order.id} />
                <Field label="Status da entrega">
                  <select name="fulfillment" defaultValue={order.fulfillmentStatus} className={inputCls}>
                    {Object.entries(FULFILLMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Código de rastreio"><input name="trackingCode" defaultValue={order.trackingCode ?? ""} className={inputCls} /></Field>
                <Field label="Observações internas"><textarea name="notes" defaultValue={order.notes ?? ""} rows={3} className={textareaCls} /></Field>
                <SubmitButton>Salvar</SubmitButton>
              </ActionForm>
            </Card>
          )}

          <Card title="Origem e UTMs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {[
                ["Canal", order.channel],
                ["Dispositivo", order.device],
                ["utm_source", order.utmSource],
                ["utm_medium", order.utmMedium],
                ["utm_campaign", order.utmCampaign],
                ["utm_content (anúncio)", order.utm?.ad ?? order.utmContent],
                ["utm_term (conjunto)", order.utm?.adset ?? order.utmTerm],
                ["1º toque", [order.firstTouchSource, order.firstTouchCampaign].filter(Boolean).join(" / ")],
                ["gclid", order.gclid],
                ["fbclid", order.fbclid],
                ["Landing", order.landingPage],
                ["Referrer", order.referrer],
              ].map(([k, v]) => (
                <div key={k as string} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate" title={String(v ?? "")}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <p className="text-xs text-slate-500">Link do cliente: <span className="break-all font-mono">{siteUrl()}/pedido/{order.orderNumber}?t=…</span></p>
        </div>
      </div>
    </div>
  );
}
