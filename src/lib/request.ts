import type { NextRequest } from "next/server";

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Proteção CSRF para rotas JSON públicas: exige que a origem da requisição seja
 * o próprio site. Server Actions já têm essa checagem embutida no Next.js.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Navegadores modernos sempre enviam Origin em POST cross-site; requisições
    // sem Origin vêm de clientes não-browser — aceitas só com fetch-site same-origin.
    const site = req.headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return originHost === host;
  } catch {
    return false;
  }
}
