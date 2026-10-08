import "server-only";

/** Períodos do admin no fuso de São Paulo (UTC-3, sem horário de verão). */
const OFFSET_MS = 3 * 3600_000;

export type Period = { key: string; label: string; from: Date; to: Date; fromInput: string; toInput: string; days: number };

const startOfDaySP = (d: Date) => {
  const local = new Date(d.getTime() - OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + OFFSET_MS);
};
const ymd = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
const parseYmd = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00-03:00`) : null);

export function resolvePeriod(sp: Record<string, string | string[] | undefined>): Period {
  const key = typeof sp.periodo === "string" ? sp.periodo : "7d";
  const now = new Date();
  const today = startOfDaySP(now);
  let from: Date;
  let to: Date = now;
  let label: string;
  switch (key) {
    case "today":
      from = today;
      label = "Hoje";
      break;
    case "yesterday":
      from = new Date(today.getTime() - 86_400_000);
      to = today;
      label = "Ontem";
      break;
    case "30d":
      from = new Date(today.getTime() - 29 * 86_400_000);
      label = "Últimos 30 dias";
      break;
    case "month": {
      const local = new Date(now.getTime() - OFFSET_MS);
      from = new Date(`${local.toISOString().slice(0, 7)}-01T00:00:00-03:00`);
      label = "Este mês";
      break;
    }
    case "custom": {
      const f = parseYmd(sp.de as string);
      const t = parseYmd(sp.ate as string);
      from = f ?? new Date(today.getTime() - 6 * 86_400_000);
      to = t ? new Date(t.getTime() + 86_400_000) : now;
      label = "Personalizado";
      break;
    }
    default:
      from = new Date(today.getTime() - 6 * 86_400_000);
      label = "Últimos 7 dias";
  }
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  return { key: ["today", "yesterday", "7d", "30d", "month", "custom"].includes(key) ? key : "7d", label, from, to, fromInput: ymd(from), toInput: ymd(new Date(to.getTime() - 1)), days };
}

export function dayKeys(p: Period): string[] {
  const out: string[] = [];
  for (let t = startOfDaySP(p.from).getTime(); t < p.to.getTime(); t += 86_400_000) out.push(ymd(new Date(t)));
  return out;
}

export const toDayKey = ymd;
