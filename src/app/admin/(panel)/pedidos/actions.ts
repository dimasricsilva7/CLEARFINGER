"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { bravopayMode, isProductionDeploy } from "@/lib/env";
import { signWebhookPayload } from "@/lib/payments/bravopay";
import { CREDIARIO_STATUSES, FULFILLMENT_LABEL, isAwaitingPix, isPaidStatus, ORDER_STATUS_LABEL, type CrediarioStatus, type FulfillmentKey } from "@/lib/domain";
import { decryptField } from "@/lib/crypto";
import { withAdmin, type ActionResult } from "@/server/admin/guard";
import { optStr, str } from "@/server/admin/forms";
import { logOrderEvent, syncOrder, updateCrediarioStatus } from "@/server/orders";
import { handleBravopayWebhook } from "@/server/webhooks";
import { syncOrderTracking } from "@/server/delivery";
import { getSettingsFresh } from "@/server/settings";
import { stageDefs, zonedTime } from "@/lib/delivery";
import type { EmailType } from "@prisma/client";
import { EMAIL_TYPE_LABEL, resendEmail } from "@/lib/email";

/** Entrega — só para pedidos com venda confirmada (PIX pago ou crediário aprovado/concluído). */
export async function updateFulfillment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const next = str(fd, "fulfillment", 20) as FulfillmentKey;
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    if (!isPaidStatus(order.status)) return { error: "Somente pedidos pagos/aprovados podem avançar na entrega." };
    if (!(next in FULFILLMENT_LABEL)) return { error: "Status inválido." };
    const trackingCode = optStr(fd, "trackingCode", 80);
    const notes = optStr(fd, "notes", 2000);
    const now = new Date();
    const updated = await db.order.update({
      where: { id },
      data: {
        fulfillmentStatus: next,
        trackingCode,
        notes,
        ...(next === "SHIPPED" && !order.shippedAt ? { shippedAt: now } : {}),
        ...(next === "DELIVERED" && !order.deliveredAt ? { deliveredAt: now } : {}),
      },
    });
    if (order.fulfillmentStatus !== next) await logOrderEvent(id, "fulfillment", `Entrega: ${FULFILLMENT_LABEL[order.fulfillmentStatus]} → ${FULFILLMENT_LABEL[next]} (admin ${admin.email})`);
    await audit(admin.id, "order_updated", "order", id, {
      summary: `Pedido ${order.orderNumber}: entrega ${FULFILLMENT_LABEL[next]}`,
      before: { fulfillmentStatus: order.fulfillmentStatus, trackingCode: order.trackingCode, notes: order.notes },
      after: { fulfillmentStatus: updated.fulfillmentStatus, trackingCode: updated.trackingCode, notes: updated.notes },
    });
    revalidatePath(`/admin/pedidos/${id}`);
    return { ok: true, message: "Pedido atualizado." };
  });
}

/** Status do crediário (análise manual do protocolo). */
export async function setCrediarioStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const next = str(fd, "status", 30) as CrediarioStatus;
    if (!(CREDIARIO_STATUSES as readonly string[]).includes(next)) return { error: "Status inválido." };
    const before = await db.order.findUniqueOrThrow({ where: { id } });
    const { order } = await updateCrediarioStatus(id, next, `admin ${admin.email}`, optStr(fd, "note", 1000));
    await audit(admin.id, "crediario_status_changed", "order", id, { summary: `Pedido ${order.orderNumber}: ${ORDER_STATUS_LABEL[before.status]} → ${ORDER_STATUS_LABEL[next]}`, before: { status: before.status }, after: { status: next } });
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin/pedidos");
    return { ok: true, message: `Status alterado para ${ORDER_STATUS_LABEL[next]}.` };
  });
}

/** Revela o protocolo completo (só admin autorizado; a visualização fica registrada na auditoria). */
export async function revealCrediario(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = str(fd, "id", 40);
    const c = await db.crediarioData.findUniqueOrThrow({ where: { orderId: id }, include: { order: { select: { orderNumber: true } } } });
    const protocol = decryptField(c.protocolEnc);
    const validity = decryptField(c.validityEnc);
    if (!protocol) return { error: "Não foi possível ler os dados (DATA_ENCRYPTION_KEY diferente da usada no pedido)." };
    await audit(admin.id, "crediario_data_viewed", "order", id, { summary: `Protocolo do pedido ${c.order.orderNumber} visualizado` });
    return { ok: true, message: `Protocolo: ${protocol.replace(/(\d{4})(?=\d)/g, "$1 ")} · Validade: ${validity ?? "—"}` };
  });
}

export async function cancelOrder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = str(fd, "id", 40);
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    if (!isAwaitingPix(order.status)) return { error: "Somente PIX aguardando pagamento podem ser cancelados aqui. Reembolsos são feitos no painel BravoPay." };
    const moved = await db.order.updateMany({ where: { id, status: order.status }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (!moved.count) return { error: "O status do pedido mudou. Recarregue a página." };
    await logOrderEvent(id, "status_change", `${order.status} → CANCELLED (admin ${admin.email})`, undefined, "CANCELLED");
    await audit(admin.id, "order_cancelled", "order", id, { summary: `Pedido ${order.orderNumber} cancelado`, before: { status: order.status }, after: { status: "CANCELLED" } });
    revalidatePath(`/admin/pedidos/${id}`);
    return { ok: true, message: "Pedido cancelado." };
  });
}

/** Consulta o status real na BravoPay (não altera nada se o gateway não confirmar). */
export async function recheckPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    const after = await syncOrder(order, { minIntervalMs: 0, source: "admin" });
    await audit(admin.id, "order_rechecked", "order", id, { summary: `Consulta ao gateway: ${order.orderNumber} (${order.status} → ${after.status})` });
    revalidatePath(`/admin/pedidos/${id}`);
    return { ok: true, message: after.status === order.status ? "Consulta feita — sem mudança de status." : `Status atualizado: ${ORDER_STATUS_LABEL[after.status]}.` };
  });
}

/** SOMENTE em modo de teste: envia um webhook assinado "transaction.paid" pelo mesmo caminho de produção. */
export async function simulatePayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    if (isProductionDeploy() || bravopayMode() !== "mock") return { error: "Disponível apenas no modo de teste (BRAVOPAY_MODE=mock)." };
    const secret = process.env.BRAVOPAY_WEBHOOK_SECRET;
    if (!secret) return { error: "Defina BRAVOPAY_WEBHOOK_SECRET para simular o webhook." };
    const order = await db.order.findUniqueOrThrow({ where: { id: str(fd, "id", 40) } });
    if (!order.transactionId) return { error: "Pedido sem PIX gerado." };
    const body = JSON.stringify({
      id: `evt_sim_${order.id}_${Date.now()}`,
      type: "transaction.paid",
      created: Math.floor(Date.now() / 1000),
      data: { id: order.transactionId, status: "PAID", method: "PIX", amount_cents: order.totalCents, fee_cents: null, net_cents: null, external_reference: order.externalReference, paid_at: new Date().toISOString() },
    });
    const result = await handleBravopayWebhook(body, new Headers({ "bravopay-signature": signWebhookPayload(body, secret) }));
    await audit(admin.id, "payment_simulated", "order", order.id, { summary: `Pagamento simulado (modo teste) ${order.orderNumber}` });
    revalidatePath(`/admin/pedidos/${order.id}`);
    return result.status === 200 ? { ok: true, message: "Webhook simulado processado." } : { error: `Falha: ${JSON.stringify(result.body)}` };
  });
}

/** Exclui o pedido (itens, pagamentos, eventos e dados do crediário). Fica registrado na auditoria. */
export async function deleteOrder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = str(fd, "id", 40);
    const order = await db.order.findUnique({ where: { id }, include: { customer: { select: { email: true } } } });
    if (!order) return { error: "Pedido não encontrado." };
    await db.order.delete({ where: { id } });
    await audit(admin.id, "order_deleted", "order", id, { summary: `Pedido ${order.orderNumber} excluído (${ORDER_STATUS_LABEL[order.status]}, ${order.customer.email})` });
    revalidatePath("/admin/pedidos");
    if (str(fd, "back", 10) === "1") redirect("/admin/pedidos");
    return { ok: true, message: `Pedido ${order.orderNumber} excluído.` };
  });
}

// ───────────── Rastreio da entrega (linha do tempo) ─────────────

const MANUAL_STATUSES = ["SEPARATING", "DC_ARRIVED", "DISPATCHED", "DEST_DC_ARRIVED", "OUT_FOR_DELIVERY", "DELIVERED", "NOTE"];

/** Lança um evento manual (ou marca como entregue). Nada é sobrescrito: o histórico automático permanece. */
export async function addTrackingEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const status = str(fd, "status", 30);
    if (!MANUAL_STATUSES.includes(status)) return { error: "Etapa inválida." };
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    if (!isPaidStatus(order.status)) return { error: "A linha do tempo só existe para pedidos pagos/aprovados." };
    const settings = await getSettingsFresh();
    const def = stageDefs(settings).find((d) => d.code === status);
    const title = str(fd, "title", 140) || def?.title || "Atualização do pedido";
    const description = optStr(fd, "description", 500) ?? def?.description ?? null;
    const when = str(fd, "occurredAt", 20);
    const m = when.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
    const occurredAt = m ? zonedTime(m[1], Number(m[2]), Number(m[3])) : new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) return { error: "A data do evento não pode estar no futuro." };
    await db.orderTrackingEvent.create({ data: { orderId: id, status, title, description, occurredAt, automatic: false, note: optStr(fd, "note", 500), createdBy: admin.email } });
    await syncOrderTracking(order, settings);
    await logOrderEvent(id, "tracking", `Rastreio: "${title}" lançado manualmente (admin ${admin.email})`);
    await audit(admin.id, "order_tracking_added", "order", id, { summary: `Pedido ${order.orderNumber}: evento de rastreio "${title}"` });
    revalidatePath(`/admin/pedidos/${id}`);
    return { ok: true, message: status === "DELIVERED" ? "Pedido marcado como entregue." : "Evento adicionado à linha do tempo." };
  });
}

/** Correção: oculta/reexibe um evento para o cliente (fica no histórico do admin). */
export async function toggleTrackingEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const eventId = str(fd, "eventId", 40);
    const ev = await db.orderTrackingEvent.findUniqueOrThrow({ where: { id: eventId } });
    const updated = await db.orderTrackingEvent.update({ where: { id: eventId }, data: { hidden: !ev.hidden, note: [ev.note, `${ev.hidden ? "Reexibido" : "Ocultado"} por ${admin.email} em ${new Date().toISOString()}`].filter(Boolean).join(" · ").slice(0, 1000) } });
    await audit(admin.id, "order_tracking_toggled", "order", ev.orderId, { summary: `Evento de rastreio "${ev.title}" ${updated.hidden ? "ocultado" : "reexibido"}` });
    revalidatePath(`/admin/pedidos/${ev.orderId}`);
    return { ok: true, message: updated.hidden ? "Evento ocultado para o cliente." : "Evento visível novamente." };
  });
}

// ───────────── E-mails do pedido ─────────────

/** Tipo de e-mail que faz sentido para o pedido agora: confirmação (pago/aprovado) ou lembrete de PIX (não pago). */
function emailTypeFor(o: { status: string; paymentMethod: string }): EmailType | null {
  if (isPaidStatus(o.status)) return "PURCHASE_CONFIRMATION";
  if (o.paymentMethod === "PIX" && (isAwaitingPix(o.status) || o.status === "EXPIRED" || o.status === "FAILED")) return "PIX_RECOVERY";
  return null;
}

export async function resendEmailAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const type = str(fd, "type", 40) as EmailType;
    if (!(type in EMAIL_TYPE_LABEL)) return { error: "Tipo de e-mail inválido." };
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { customer: { select: { email: true } } } });
    const r = await resendEmail(id, type, admin.id);
    await audit(admin.id, "email_resent", "order", id, { summary: `${EMAIL_TYPE_LABEL[type]} — pedido ${order.orderNumber} para ${order.customer.email}: ${r.ok ? "enviado" : r.error}` });
    revalidatePath(`/admin/pedidos/${id}`);
    return r.ok ? { ok: true, message: `${EMAIL_TYPE_LABEL[type]} enviado para ${order.customer.email}.` } : { error: r.error };
  });
}

/** Botão da lista: reenvia o e-mail adequado ao status (lembrete de PIX para não pagos, confirmação para pagos). */
export async function quickResendEmail(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { customer: { select: { email: true } } } });
    const type = emailTypeFor(order);
    if (!type) return { error: "Este pedido não tem e-mail para reenviar no status atual." };
    const r = await resendEmail(id, type, admin.id);
    await audit(admin.id, "email_resent", "order", id, { summary: `${EMAIL_TYPE_LABEL[type]} — pedido ${order.orderNumber} para ${order.customer.email}: ${r.ok ? "enviado" : r.error}` });
    revalidatePath("/admin/pedidos");
    return r.ok ? { ok: true, message: `${EMAIL_TYPE_LABEL[type]} enviado para ${order.customer.email}.` } : { error: r.error };
  });
}
