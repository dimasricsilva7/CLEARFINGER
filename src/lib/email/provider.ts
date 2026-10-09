import "server-only";
import { isProductionDeploy } from "@/lib/env";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; idempotencyKey?: string; headers?: Record<string, string> };
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string; retryable: boolean };

/**
 * Resend (API REST, sem SDK). Credenciais só em variáveis de ambiente:
 *   RESEND_API_KEY   re_...
 *   EMAIL_FROM       "CLEARFINGER <pedidos@clearfinger.shop>" (domínio verificado na Resend)
 *   EMAIL_REPLY_TO   opcional (e-mail de atendimento)
 * Sem chave em desenvolvimento, EMAIL_PROVIDER=console apenas registra no log.
 */
export function emailProvider(): "resend" | "console" | "none" {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.EMAIL_PROVIDER === "console" && !isProductionDeploy()) return "console";
  return "none";
}

export async function deliver(email: OutgoingEmail, replyTo?: string | null): Promise<SendResult> {
  const provider = emailProvider();
  if (provider === "none") return { ok: false, error: "E-mail não configurado (RESEND_API_KEY/EMAIL_FROM).", retryable: true };
  if (provider === "console") {
    console.info(JSON.stringify({ level: "info", scope: "email", message: "console", to: email.to.replace(/(.{2}).*@/, "$1***@"), subject: email.subject }));
    return { ok: true, id: `console_${Date.now()}` };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.headers ? { headers: email.headers } : {}),
        ...(replyTo || process.env.EMAIL_REPLY_TO ? { reply_to: replyTo || process.env.EMAIL_REPLY_TO } : {}),
      }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${json.message ?? "erro"}`.slice(0, 300), retryable: res.status >= 500 || res.status === 429 };
    return { ok: true, id: json.id ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "erro de rede", retryable: true };
  }
}
