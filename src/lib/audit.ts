import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/crypto";
import { getClientIp } from "@/lib/request";

type Json = Record<string, unknown>;

const SECRET_KEYS = /password|hash|token|secret|digitalFileUrl/i;

/** Normaliza valores para comparação/armazenamento (datas → ISO, segredos mascarados). */
function clean(obj: Json | null | undefined): Json | null {
  if (!obj) return null;
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !["updatedAt", "createdAt"].includes(k))
      .map(([k, v]) => [k, SECRET_KEYS.test(k) ? (v ? "[alterado]" : v) : v instanceof Date ? v.toISOString() : v])
  );
}

/** Somente os campos que mudaram (valor anterior × novo). */
export function diff(before: Json | null | undefined, after: Json | null | undefined) {
  const b = clean(before) ?? {};
  const a = clean(after) ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  return {
    before: Object.fromEntries(keys.map((k) => [k, b[k] ?? null])),
    after: Object.fromEntries(keys.map((k) => [k, a[k] ?? null])),
    changed: keys,
  };
}

export async function audit(
  adminId: string | null,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  opts: { summary?: string; before?: Json | null; after?: Json | null; details?: Json } = {}
) {
  let ipHash: string | null = null;
  try {
    ipHash = hashIp(getClientIp(await headers()));
  } catch {
    // fora de um request (jobs)
  }
  const d = opts.before !== undefined || opts.after !== undefined ? diff(opts.before, opts.after) : null;
  if (d && !d.changed.length && action.endsWith("_updated")) return; // nada mudou
  await db.auditLog
    .create({
      data: {
        adminId,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        summary: opts.summary?.slice(0, 500) ?? null,
        before: (d?.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (d?.after ?? undefined) as Prisma.InputJsonValue | undefined,
        details: (opts.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipHash,
      },
    })
    .catch((e) => console.error(JSON.stringify({ level: "error", scope: "audit", action, error: e instanceof Error ? e.message : String(e) })));
}
