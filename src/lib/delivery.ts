/**
 * Linha do tempo automática de entrega — cálculo puro (sem banco), testável.
 *
 * Regras (fuso America/Sao_Paulo, só dias úteis: sábado, domingo e feriados configurados são pulados):
 *  S1 Pagamento concluído ............ no horário do pagamento
 *  S2 Separando pedido ............... próximo dia útil, 10:30
 *  S3 Chegou ao centro de distribuição  mesmo dia do S2, 16:30
 *  S4 Despachado para a cidade destino  próximo dia útil, 09:30
 *  S5 Chegou ao CD da cidade destino .. mesmo dia do S4, 16:30
 *  S6 Saiu para entrega .............. próximo dia útil, 10:30
 *  Entregue .......................... somente manual (admin)
 */

export const DELIVERY_TZ = "America/Sao_Paulo";

export type StageCode = "PAID" | "SEPARATING" | "DC_ARRIVED" | "DISPATCHED" | "DEST_DC_ARRIVED" | "OUT_FOR_DELIVERY" | "DELIVERED";

export type StageDef = { code: StageCode; title: string; description: string };

export const DEFAULT_STAGES: StageDef[] = [
  { code: "PAID", title: "Pagamento concluído", description: "Recebemos a confirmação do seu pagamento." },
  { code: "SEPARATING", title: "Separando pedido", description: "Seu pedido foi confirmado e está sendo preparado para envio." },
  { code: "DC_ARRIVED", title: "Pedido chegou ao centro de distribuição", description: "Seu pedido chegou ao centro de distribuição e está sendo processado." },
  { code: "DISPATCHED", title: "Pedido despachado para a cidade de destino", description: "Seu pedido foi encaminhado para a unidade responsável pela entrega na sua região." },
  { code: "DEST_DC_ARRIVED", title: "Pedido chegou ao centro de distribuição da cidade destino", description: "Seu pedido chegou à unidade responsável pela entrega final." },
  { code: "OUT_FOR_DELIVERY", title: "Pedido saiu para entrega", description: "Seu pedido está a caminho. Aguarde a entrega no endereço informado." },
  { code: "DELIVERED", title: "Pedido entregue", description: "Seu pedido foi entregue. Aproveite!" },
];

export const STAGE_ORDER: StageCode[] = DEFAULT_STAGES.map((s) => s.code);
export const AUTOMATIC_STAGES: StageCode[] = STAGE_ORDER.filter((c) => c !== "DELIVERED");

/** Situação de envio refletida em Order.fulfillmentStatus por etapa. */
export const STAGE_FULFILLMENT: Partial<Record<StageCode, "PROCESSING" | "SHIPPED" | "DELIVERED">> = {
  SEPARATING: "PROCESSING",
  DC_ARRIVED: "PROCESSING",
  DISPATCHED: "SHIPPED",
  DEST_DC_ARRIVED: "SHIPPED",
  OUT_FOR_DELIVERY: "SHIPPED",
  DELIVERED: "DELIVERED",
};

/** Textos com override das configurações (tracking_<code>_title / _description). */
export function stageDefs(settings: Record<string, string | undefined> = {}): StageDef[] {
  return DEFAULT_STAGES.map((d) => {
    const k = d.code.toLowerCase();
    return { code: d.code, title: settings[`tracking_${k}_title`]?.trim() || d.title, description: settings[`tracking_${k}_description`]?.trim() || d.description };
  });
}

/** "2026-12-25, 2027-01-01" → Set de datas (YYYY-MM-DD). */
export function parseHolidays(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[\s,;]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
}

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: DELIVERY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Data local (YYYY-MM-DD) em São Paulo. */
export function localYmd(d: Date): string {
  return ymdFmt.format(d);
}

/** Diferença (ms) entre o horário local de São Paulo e UTC num instante. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: DELIVERY_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - (at.getTime() - at.getMilliseconds());
}

/** Instante correspondente a YYYY-MM-DD hh:mm no horário de São Paulo. */
export function zonedTime(ymd: string, hh: number, mm: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function isBusinessDay(ymd: string, holidays: Set<string> = new Set()): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.has(ymd);
}

/** Próximo dia útil estritamente depois de `ymd`. */
export function nextBusinessDay(ymd: string, holidays: Set<string> = new Set()): string {
  let cur = addDays(ymd, 1);
  for (let i = 0; i < 60 && !isBusinessDay(cur, holidays); i++) cur = addDays(cur, 1);
  return cur;
}

export type ScheduledStage = StageDef & { at: Date };

/** Agenda completa das etapas automáticas a partir do pagamento confirmado. */
export function computeSchedule(paidAt: Date, opts: { holidays?: Set<string>; settings?: Record<string, string | undefined> } = {}): ScheduledStage[] {
  const h = opts.holidays ?? new Set<string>();
  const defs = new Map(stageDefs(opts.settings).map((d) => [d.code, d]));
  const d2 = nextBusinessDay(localYmd(paidAt), h);
  const d4 = nextBusinessDay(d2, h);
  const d6 = nextBusinessDay(d4, h);
  const at: [StageCode, Date][] = [
    ["PAID", paidAt],
    ["SEPARATING", zonedTime(d2, 10, 30)],
    ["DC_ARRIVED", zonedTime(d2, 16, 30)],
    ["DISPATCHED", zonedTime(d4, 9, 30)],
    ["DEST_DC_ARRIVED", zonedTime(d4, 16, 30)],
    ["OUT_FOR_DELIVERY", zonedTime(d6, 10, 30)],
  ];
  return at.map(([code, when]) => ({ ...defs.get(code)!, at: when }));
}

/** Etapas automáticas já vencidas em `now`. */
export function dueStages(paidAt: Date, now: Date, opts: Parameters<typeof computeSchedule>[1] = {}): ScheduledStage[] {
  return computeSchedule(paidAt, opts).filter((s) => s.at.getTime() <= now.getTime());
}

export function stageRank(code: string): number {
  const i = STAGE_ORDER.indexOf(code as StageCode);
  return i < 0 ? -1 : i;
}

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: DELIVERY_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatTrackingDate = (d: Date | string) => dateTimeFmt.format(new Date(d)).replace(",", " às");
