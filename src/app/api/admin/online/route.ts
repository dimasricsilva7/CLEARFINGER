import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const WINDOW_MS = 90_000; // batimento a cada 30 s → online = visto nos últimos 90 s

function pageLabel(raw: string | null) {
  const path = raw?.split("?")[0] ?? null;
  if (!path || path === "/") return "Landing page";
  if (path.startsWith("/checkout")) return "Checkout";
  if (path.startsWith("/pedido")) return "Página do pedido";
  return path;
}

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessions = await db.visitorSession.findMany({
    where: { lastSeenAt: { gte: new Date(Date.now() - WINDOW_MS) }, NOT: { device: "servidor" } },
    select: { exitPage: true, device: true, utmSource: true, channel: true },
    take: 1000,
  });
  const count = (key: (s: (typeof sessions)[number]) => string) => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, n]) => ({ label, n }));
  };
  return NextResponse.json(
    {
      online: sessions.length,
      pages: count((s) => pageLabel(s.exitPage)),
      sources: count((s) => s.utmSource ?? s.channel ?? "direto"),
      devices: count((s) => s.device ?? "desconhecido"),
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
