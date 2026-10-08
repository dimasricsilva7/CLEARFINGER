/**
 * Integração BravoPay (https://bravopay.club/docs)
 *
 * - Base URL: https://bravopay.club/api/v1  · Auth: Authorization: Bearer <BRAVOPAY_API_KEY>
 * - POST /transactions (method "pix") com Idempotency-Key
 * - GET  /transactions?external_reference=...  (consulta/reconciliação)
 * - Webhooks assinados: header BravoPay-Signature / X-Bravopay-Signature
 *   no formato `t=<unix>,v1=<hmac_sha256_hex>` sobre `${t}.${rawBody}`.
 *
 * Este módulo só roda no servidor. A chave NUNCA vai para o navegador.
 */
import crypto from "crypto";

export type BravopayStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CHARGEBACK" | "FAILED";

export type BravopayTransaction = {
  id: string;
  object?: string;
  status: BravopayStatus;
  method?: string;
  amount_cents: number;
  fee_cents?: number | null;
  net_cents?: number | null;
  currency?: string;
  external_reference?: string | null;
  metadata?: Record<string, string> | null;
  pix?: { copy_paste: string; expires_at: string } | null;
  tracking?: Record<string, string> | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BravopayWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: BravopayTransaction;
};

export type PixCustomer = { name: string; email: string; cpf: string; phone: string };

export type PixTracking = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
};

export type CreatePixInput = {
  amountCents: number;
  idempotencyKey: string;
  externalReference: string;
  description: string;
  customer: PixCustomer;
  metadata?: Record<string, string>;
  utm?: PixTracking;
  expiresInSeconds?: number;
};

export const WEBHOOK_EVENTS = [
  "transaction.created",
  "transaction.paid",
  "transaction.refunded",
  "transaction.chargeback",
  "transaction.expired",
  "transaction.failed",
  "transaction.receipt_uploaded",
] as const;

export class BravopayError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "BravopayError";
  }
}

const baseUrl = () => (process.env.BRAVOPAY_BASE_URL || "https://bravopay.club/api/v1").replace(/\/$/, "");

function isMock(): boolean {
  const prodDeploy =
    process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
  return process.env.BRAVOPAY_MODE === "mock" && !prodDeploy;
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.BRAVOPAY_API_KEY;
  if (!key) throw new BravopayError("BRAVOPAY_API_KEY não configurada", 500, "missing_api_key");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store", signal: controller.signal });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    if (!res.ok) {
      throw new BravopayError(json?.error?.message ?? `BravoPay request failed (${res.status})`, res.status, json?.error?.code);
    }
    return json as T;
  } catch (err) {
    if (err instanceof BravopayError) throw err;
    throw new BravopayError(err instanceof Error ? err.message : "network_error", 502, "network_error");
  } finally {
    clearTimeout(timeout);
  }
}

const clean = (v?: string | null) => (v ? String(v).slice(0, 200) : undefined);

/** Monta o corpo exatamente como documentado em POST /transactions. */
export function buildPixBody(input: CreatePixInput) {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .slice(0, 20)
      .map(([k, v]) => [k, String(v).slice(0, 200)])
  );
  const utm = Object.fromEntries(
    Object.entries({
      source: clean(input.utm?.source),
      medium: clean(input.utm?.medium),
      campaign: clean(input.utm?.campaign),
      content: clean(input.utm?.content),
      term: clean(input.utm?.term),
      fbclid: clean(input.utm?.fbclid),
      gclid: clean(input.utm?.gclid),
      ttclid: clean(input.utm?.ttclid),
    }).filter(([, v]) => v)
  );
  const productId = process.env.BRAVOPAY_PRODUCT_ID;

  return {
    amount_cents: input.amountCents,
    method: "pix" as const,
    ...(productId ? { product_id: productId } : {}),
    description: input.description.slice(0, 300),
    external_reference: input.externalReference.slice(0, 120),
    expires_in: Math.min(86400, Math.max(60, input.expiresInSeconds ?? 3600)),
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      cpf: input.customer.cpf.replace(/\D/g, ""),
      phone: input.customer.phone.replace(/\D/g, ""),
    },
    metadata,
    ...(Object.keys(utm).length ? { utm } : {}),
  };
}

export async function createPixTransaction(input: CreatePixInput): Promise<BravopayTransaction> {
  if (input.amountCents < 500) throw new BravopayError("Valor mínimo do PIX é R$ 5,00", 422, "amount_too_low");
  const body = buildPixBody(input);

  if (isMock()) {
    const expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();
    const id = `mock_tx_${crypto.randomBytes(8).toString("hex")}`;
    return {
      id,
      object: "transaction",
      status: "PENDING",
      method: "PIX",
      amount_cents: body.amount_cents,
      fee_cents: null,
      net_cents: null,
      currency: "BRL",
      external_reference: body.external_reference,
      pix: {
        // Código claramente fictício — não é um BR Code pagável.
        copy_paste: `MOCK-PIX-CLEARFINGER-${body.external_reference}-${id}-NAO-PAGAVEL`,
        expires_at: expiresAt,
      },
      created_at: new Date().toISOString(),
    };
  }

  return request<BravopayTransaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: input.idempotencyKey,
  });
}

/** Busca uma transação pela external_reference (número do pedido CLEARFINGER). */
export async function getTransaction(externalReference: string): Promise<BravopayTransaction | null> {
  if (isMock()) return null; // em mock o estado vive só no banco (simulado via webhook de teste)
  const qs = new URLSearchParams({ external_reference: externalReference, limit: "5" });
  const result = await request<{ data: BravopayTransaction[] }>(`/transactions?${qs.toString()}`, { method: "GET" });
  const list = result.data ?? [];
  // Se houver mais de uma (não deveria), a paga tem prioridade.
  return list.find((t) => t.status === "PAID") ?? list[0] ?? null;
}

/** Lista transações por status/janela — usado na reconciliação em lote. */
export async function listTransactions(params: {
  status?: BravopayStatus;
  createdFrom?: Date;
  createdTo?: Date;
  limit?: number;
  cursor?: string;
}): Promise<{ data: BravopayTransaction[]; has_more?: boolean; next_cursor?: string | null }> {
  if (isMock()) return { data: [] };
  const qs = new URLSearchParams({ limit: String(params.limit ?? 100) });
  if (params.status) qs.set("status", params.status);
  if (params.createdFrom) qs.set("created_at_from", params.createdFrom.toISOString());
  if (params.createdTo) qs.set("created_at_to", params.createdTo.toISOString());
  if (params.cursor) qs.set("cursor", params.cursor);
  return request(`/transactions?${qs.toString()}`, { method: "GET" });
}

/**
 * Confirma no servidor da BravoPay o status real de um pedido. Nunca confiamos
 * apenas no navegador: "Já paguei" só dispara esta verificação.
 */
export async function verifyTransaction(externalReference: string, expectedAmountCents: number) {
  const tx = await getTransaction(externalReference);
  if (!tx) return { found: false as const, tx: null, amountMatches: false };
  return { found: true as const, tx, amountMatches: tx.amount_cents === expectedAmountCents };
}

/**
 * Verifica a assinatura HMAC-SHA256 do webhook.
 * Formato: `t=<unix_timestamp>,v1=<hex>` ; conteúdo assinado: `${t}.${rawBody}`.
 * Rejeita timestamps com mais de `toleranceSeconds` de diferença (anti-replay).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 300,
  nowMs = Date.now()
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts: Record<string, string> = {};
  for (const piece of signatureHeader.split(",")) {
    const idx = piece.indexOf("=");
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1 || !/^\d+$/.test(t) || !/^[a-f0-9]+$/i.test(v1)) return false;

  const age = Math.abs(nowMs / 1000 - Number(t));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Gera um header de assinatura válido (usado apenas pela ferramenta de teste de webhook e nos testes). */
export function signWebhookPayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/** Status efetivo de um evento: o tipo do evento prevalece sobre data.status. */
export function statusFromEvent(event: BravopayWebhookEvent): BravopayStatus | null {
  switch (event.type) {
    case "transaction.paid":
      return "PAID";
    case "transaction.refunded":
      return "REFUNDED";
    case "transaction.chargeback":
      return "CHARGEBACK";
    case "transaction.expired":
      return "EXPIRED";
    case "transaction.failed":
      return "FAILED";
    case "transaction.created":
      return "PENDING";
    default:
      return event.data?.status ?? null;
  }
}

/**
 * Valida e interpreta um webhook bruto. Retorna o evento somente se a
 * assinatura for válida — nunca processe um payload sem passar por aqui.
 */
export function processWebhook(rawBody: string, headers: Headers):
  | { ok: true; event: BravopayWebhookEvent; payloadHash: string }
  | { ok: false; reason: "invalid_signature" | "invalid_payload" } {
  const signature = headers.get("bravopay-signature") ?? headers.get("x-bravopay-signature");
  if (!verifyWebhookSignature(rawBody, signature, process.env.BRAVOPAY_WEBHOOK_SECRET)) {
    return { ok: false, reason: "invalid_signature" };
  }
  try {
    const event = JSON.parse(rawBody) as BravopayWebhookEvent;
    if (!event?.id || !event?.type || typeof event.data !== "object") return { ok: false, reason: "invalid_payload" };
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    return { ok: true, event, payloadHash };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}
