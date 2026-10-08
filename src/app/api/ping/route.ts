import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Batimento da aba aberta (a cada 30 s, só com a aba visível) → "online agora" no dashboard.
 * Só atualiza sessões que já existem (criadas pelo /api/track, que filtra robôs).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`ping:${getClientIp(req.headers)}`, 12, 60_000)) return new NextResponse(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { sid?: string; path?: string } | null;
  const sid = body?.sid;
  if (!sid || !/^[A-Za-z0-9_-]{8,64}$/.test(sid)) return new NextResponse(null, { status: 204 });
  await db.visitorSession
    .updateMany({ where: { id: sid }, data: { lastSeenAt: new Date(), ...(body?.path ? { exitPage: String(body.path).slice(0, 500) } : {}) } })
    .catch(() => null);
  return new NextResponse(null, { status: 204 });
}
