import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Badge, Card, Field, PageHeader, ORDER_TONE, inputCls, textareaCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { CREDIARIO_TRANSITIONS, FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, isAwaitingPix, isPaidStatus, type CrediarioStatus } from "@/lib/domain";
import { bravopayMode, isProductionDeploy, siteUrl } from "@/lib/env";
import { decryptField } from "@/lib/crypto";
import { maskCpfLast } from "@/lib/crediario";
import { db } from "@/lib/db";
import { formatBRL, formatCep, formatCpf, formatDate, formatPhone } from "@/utils/format";
import { cancelOrder, deleteOrder, recheckPayment, revealCrediario, setCrediarioStatus, simulatePayment, updateFulfillment } from "../actions";

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
  const [webhooks, events] = await Promise.all([
    db.webhookEvent.findMany({ where: { OR: [{ orderId: order.id }, ...(order.transactionId ? [{ transactionId: order.transactionId }] : [])] }, orderBy: { receivedAt: "asc" } }),
    order.sessionId ? db.trackingEvent.findMany({ where: { sessionId: order.sessionId }, orderBy: { createdAt: "asc" }, take: 150, select: { id: true, name: true, element: true, path: true, createdAt: true } }) : Promise.resolve([]),
  ]);
  const addr = order.shippingAddress as { cep?: string; street?: string; number?: string; complement?: string | null; district?: string; city?: string; state?: string } | null;
  const snap = order.customerSnapshot as { name?: string; cpf?: string | null };
  const mock = bravopayMode() === "mock" && !isProductionDeploy();
  const isPix = order.paymentMethod === "PIX";
  const cred = order.crediario;
  const cpfLast = cred ? decryptField(cred.cpfLast3Enc) : null;
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
                <Row k="Protocolo" v={<span className="font-mono">•••• •••• •••• {cred.protocolLast4}</span>} />
                <Row k="Validade" v={<span className="text-slate-400">oculta</span>} />
                <Row k="CPF (últimos dígitos)" v={<span className="font-mono">{cpfLast ? maskCpfLast(cpfLast) : "—"}</span>} />
                <Row k="Parcelas" v={`${cred.installments}x · ${cred.installmentLabel}`} />
                <Row k="Status" v={<Badge tone={ORDER_TONE[order.status] ?? "slate"}>{ORDER_STATUS_LABEL[order.status]}</Badge>} />
                {order.approvedAt && <Row k="Aprovado em" v={formatDate(order.approvedAt, true)} />}
                {order.rejectedAt && <Row k="Recusado em" v={formatDate(order.rejectedAt, true)} />}
                {cred.analysisNote && <Row k="Observação da análise" v={cred.analysisNote} />}
              </dl>
              <ActionForm action={revealCrediario} className="mt-3">
                <input type="hidden" name="id" value={order.id} />
                <SubmitButton className={btnSecondary} pendingText="Abrindo…">Ver protocolo completo e validade</SubmitButton>
                <p className="text-xs text-slate-500">A visualização fica registrada na auditoria. Os dados ficam cifrados no banco e nunca são enviados ao Meta/Google.</p>
              </ActionForm>
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

          <Card title="Linha do tempo">
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
