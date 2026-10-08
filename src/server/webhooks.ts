import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { paymentService, type NormalizedWebhook } from "@/lib/payments";
import { applyPaymentSnapshot, logOrderEvent } from "@/server/orders";

export type WebhookResult = { status: number; body: Record<string, unknown> };

/** Remove dados pessoais do cliente e o código PIX antes de guardar o payload bruto. */
function stripPii(raw: unknown) {
  const event = { ...(raw as Record<string, unknown>) };
  const data = { ...((event.data ?? {}) as Record<string, unknown>) };
  if (data.customer) data.customer = "[redacted]";
  if (data.pix) data.pix = "[omitted]";
  return { ...event, data } as Prisma.InputJsonValue;
}

/**
 * Webhook BravoPay:
 * 1. valida a assinatura HMAC-SHA256 (sem assinatura válida → 401, nada é processado);
 * 2. registra o evento (event_id único → idempotência: duplicatas não são reprocessadas);
 * 3. aplica o status no pedido pelo ponto único applyPaymentSnapshot;
 * 4. grava status anterior, novo e resultado.
 */
export async function handleBravopayWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
  const parsed = paymentService.handleWebhook(rawBody, headers);
  if (!parsed.ok) {
    log.warn("webhook", "rejeitado", { reason: parsed.reason });
    return { status: parsed.reason === "invalid_signature" ? 401 : 400, body: { error: parsed.reason } };
  }
  const event = parsed.event;

  try {
    await db.webhookEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.type,
        transactionId: event.snapshot.transactionId ?? null,
        payloadHash: event.payloadHash,
        payload: stripPii(event.raw),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const prev = await db.webhookEvent.update({ where: { eventId: event.eventId }, data: { attempts: { increment: 1 } } });
      // Duplicata já processada → confirma sem reprocessar. Se a anterior falhou, reprocessa.
      if (prev.status === "PROCESSED" || prev.status === "IGNORED") {
        log.info("webhook", "duplicado ignorado", { eventId: event.eventId, type: event.type });
        return { status: 200, body: { ok: true, duplicate: true } };
      }
    } else {
      throw err;
    }
  }
  return processWebhookEvent(event);
}

export async function processWebhookEvent(event: NormalizedWebhook): Promise<WebhookResult> {
  try {
    const snap = event.snapshot;
    const order = snap.externalReference
      ? await db.order.findUnique({ where: { externalReference: snap.externalReference } })
      : snap.transactionId
        ? await db.order.findUnique({ where: { transactionId: snap.transactionId } })
        : null;

    if (!order) {
      await db.webhookEvent.update({ where: { eventId: event.eventId }, data: { status: "IGNORED", processedAt: new Date(), result: "order_not_found" } });
      log.warn("webhook", "pedido não encontrado", { eventId: event.eventId, type: event.type, ref: snap.externalReference });
      return { status: 200, body: { ok: true, ignored: true } };
    }

    await logOrderEvent(order.id, "webhook", `Webhook ${event.type} recebido`, { event_id: event.eventId, transaction_id: snap.transactionId, status: snap.status });

    let result = "processed";
    let previousStatus: string | null = order.status;
    let newStatus: string | null = order.status;

    if (event.type === "transaction.receipt_uploaded") {
      await logOrderEvent(order.id, "receipt_uploaded", "Cliente enviou comprovante na BravoPay (verificar no painel BravoPay)");
      result = "receipt_logged";
    } else if (event.type.startsWith("transaction.")) {
      const applied = await applyPaymentSnapshot(order.id, snap, "webhook", event.status);
      previousStatus = applied.previousStatus;
      newStatus = applied.newStatus;
      result = applied.changed ? "status_changed" : (applied.note ?? "no_change");
    } else {
      result = "event_not_handled";
    }

    await db.webhookEvent.update({
      where: { eventId: event.eventId },
      data: { status: "PROCESSED", processedAt: new Date(), orderId: order.id, previousStatus, newStatus, result, error: null },
    });
    log.info("webhook", "processado", { eventId: event.eventId, type: event.type, order: order.orderNumber, previousStatus, newStatus, result });
    return { status: 200, body: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    log.error("webhook", "erro ao processar", { eventId: event.eventId, type: event.type, error: message });
    await db.webhookEvent.update({ where: { eventId: event.eventId }, data: { status: "FAILED", error: message.slice(0, 500) } }).catch(() => {});
    // 500 → a BravoPay tenta novamente (até 8 tentativas com backoff)
    return { status: 500, body: { error: "processing_failed" } };
  }
}

/** Reprocessa webhooks que falharam (job). O payload salvo já passou pela validação de assinatura. */
export async function retryFailedWebhooks(limit = 10) {
  const failed = await db.webhookEvent.findMany({
    where: { status: { in: ["FAILED", "RECEIVED"] }, receivedAt: { lt: new Date(Date.now() - 60_000) } },
    take: limit,
    orderBy: { receivedAt: "asc" },
  });
  for (const w of failed) await processWebhookEvent(paymentService.normalizeStoredEvent(w.payload, w.payloadHash));
  return { retried: failed.length };
}
