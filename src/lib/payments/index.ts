import "server-only";
/**
 * paymentService — ÚNICA interface de pagamento usada pelo restante do sistema.
 * A lógica específica do gateway fica isolada no adaptador (./bravopay.ts).
 * Para trocar de gateway, basta implementar um novo adaptador com o mesmo contrato.
 */
import {
  BravopayError,
  createPixTransaction,
  getTransaction,
  processWebhook,
  statusFromEvent,
  type BravopayStatus,
  type BravopayTransaction,
  type BravopayWebhookEvent,
  type CreatePixInput,
} from "./bravopay";

export type PaymentStatus = BravopayStatus; // PENDING | PAID | EXPIRED | REFUNDED | CHARGEBACK | FAILED

export type PaymentSnapshot = {
  provider: "bravopay";
  transactionId: string;
  status: PaymentStatus;
  amountCents: number;
  feeCents: number | null;
  netCents: number | null;
  paidAt: Date | null;
  externalReference: string | null;
  metadata: Record<string, string> | null;
  tracking: Record<string, string> | null;
};

export type PixCharge = PaymentSnapshot & { copyPaste: string; expiresAt: Date | null };

export type NormalizedWebhook = {
  eventId: string;
  type: string;
  /** Status efetivo (o tipo do evento prevalece sobre data.status) */
  status: PaymentStatus | null;
  snapshot: PaymentSnapshot;
  payloadHash: string;
  raw: unknown;
};

export class PaymentError extends Error {
  constructor(
    message: string,
    public status = 502,
    public code?: string
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

function toSnapshot(tx: BravopayTransaction): PaymentSnapshot {
  return {
    provider: "bravopay",
    transactionId: tx.id,
    status: tx.status,
    amountCents: tx.amount_cents,
    feeCents: tx.fee_cents ?? null,
    netCents: tx.net_cents ?? null,
    paidAt: tx.paid_at ? new Date(tx.paid_at) : null,
    externalReference: tx.external_reference ?? null,
    metadata: tx.metadata ?? null,
    tracking: tx.tracking ?? null,
  };
}

const wrap = (err: unknown): PaymentError =>
  err instanceof BravopayError
    ? new PaymentError(err.message, err.status, err.code)
    : new PaymentError(err instanceof Error ? err.message : "payment_error");

export const paymentService = {
  provider: "bravopay" as const,

  /** Gera uma cobrança PIX. Idempotente pela idempotencyKey (24h na BravoPay). */
  async createPixPayment(input: CreatePixInput): Promise<PixCharge> {
    try {
      const tx = await createPixTransaction(input);
      if (!tx.pix?.copy_paste) throw new PaymentError("Resposta sem código PIX", 502, "missing_pix");
      return { ...toSnapshot(tx), copyPaste: tx.pix.copy_paste, expiresAt: tx.pix.expires_at ? new Date(tx.pix.expires_at) : null };
    } catch (err) {
      throw err instanceof PaymentError ? err : wrap(err);
    }
  },

  /** Consulta o status real no gateway pela referência externa (número do pedido). */
  async getPaymentStatus(externalReference: string): Promise<PaymentSnapshot | null> {
    try {
      const tx = await getTransaction(externalReference);
      return tx ? toSnapshot(tx) : null;
    } catch (err) {
      throw wrap(err);
    }
  },

  /** Valida assinatura e normaliza o webhook. Nunca processe um payload sem passar por aqui. */
  handleWebhook(rawBody: string, headers: Headers): { ok: true; event: NormalizedWebhook } | { ok: false; reason: "invalid_signature" | "invalid_payload" } {
    const parsed = processWebhook(rawBody, headers);
    if (!parsed.ok) return parsed;
    return { ok: true, event: paymentService.normalizeStoredEvent(parsed.event, parsed.payloadHash) };
  },

  /** Normaliza um evento já validado (usado também no reprocessamento de webhooks salvos). */
  normalizeStoredEvent(raw: unknown, payloadHash: string): NormalizedWebhook {
    const event = raw as BravopayWebhookEvent;
    return { eventId: event.id, type: event.type, status: statusFromEvent(event), snapshot: toSnapshot(event.data), payloadHash, raw: event };
  },

  /**
   * Reembolso: a documentação atual da BravoPay (bravopay.club/docs) NÃO documenta
   * endpoint de reembolso via API. Reembolsos são feitos no painel da BravoPay e o
   * webhook transaction.refunded atualiza o pedido automaticamente.
   */
  async refundPayment(_transactionId: string): Promise<never> {
    throw new PaymentError("Reembolso via API não suportado pela BravoPay. Faça o reembolso no painel BravoPay.", 501, "refund_not_supported");
  },
};

export type { CreatePixInput };
