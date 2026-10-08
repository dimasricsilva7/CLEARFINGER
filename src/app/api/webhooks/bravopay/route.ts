import { NextResponse, type NextRequest } from "next/server";
import { handleBravopayWebhook } from "@/server/webhooks";

export const dynamic = "force-dynamic";

/**
 * Webhook BravoPay — configure no painel BravoPay: https://SEU-DOMINIO/api/webhooks/bravopay
 * O corpo bruto é lido como texto (a assinatura HMAC é calculada sobre os bytes exatos).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const result = await handleBravopayWebhook(raw, req.headers);
  return NextResponse.json(result.body, { status: result.status });
}
