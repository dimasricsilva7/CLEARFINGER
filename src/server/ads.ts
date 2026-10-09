import "server-only";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { PAID_STATUSES } from "@/lib/domain";
import { getSettingsFresh, type Settings } from "@/server/settings";

/**
 * Gastos de anúncios (Meta) × vendas confirmadas do site.
 * - Gasto: Marketing API (insights por campanha e por dia), na moeda da conta (USD).
 * - Conversão: PTAX venda do Banco Central do dia (ou cotação manual) + IOF/taxa do cartão.
 * - Receita: pedidos confirmados (PIX pago, crediário aprovado/concluído) em reais.
 * Token só no servidor: META_ADS_ACCESS_TOKEN (ads_read). Contas em Configurações → Anúncios.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
export const adsToken = () => process.env.META_ADS_ACCESS_TOKEN?.trim() || null;
export const adAccountIds = (s: Settings) =>
  (s.ads_account_ids ?? "")
    .split(/[\s,;]+/)
    .map((x) => x.replace(/^act_/, "").replace(/\D/g, ""))
    .filter((x) => x.length >= 5);

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => ymd(new Date(Date.parse(`${s}T12:00:00Z`) + n * 86_400_000));
export const spDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

type InsightRow = {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  account_currency?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};
const PURCHASE_TYPES = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
const pick = (list: { action_type: string; value: string }[] | undefined) => {
  for (const t of PURCHASE_TYPES) {
    const v = list?.find((a) => a.action_type === t);
    if (v) return Number(v.value) || 0;
  }
  return 0;
};

/** Importa insights diários por campanha (padrão: últimos 3 dias, que a Meta ainda ajusta). */
export async function syncAdSpend(days = 3) {
  const token = adsToken();
  const s = await getSettingsFresh();
  const accounts = adAccountIds(s);
  if (!token || !accounts.length) return { skipped: true as const, reason: !token ? "sem META_ADS_ACCESS_TOKEN" : "nenhuma conta configurada" };
  const until = spDate(new Date());
  const since = addDays(until, -(Math.max(1, Math.min(90, days)) - 1));
  const result: Record<string, number | string> = {};
  for (const acc of accounts) {
    let url: string | null =
      `${GRAPH}/act_${acc}/insights?` +
      new URLSearchParams({
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({ since, until }),
        fields: "campaign_id,campaign_name,account_currency,spend,impressions,clicks,inline_link_clicks,actions,action_values",
        limit: "500",
        access_token: token,
      }).toString();
    let rows = 0;
    try {
      while (url) {
        const res: Response = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as { data?: InsightRow[]; paging?: { next?: string }; error?: { message: string; code: number } };
        if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
        for (const r of json.data ?? []) {
          const data = {
            campaignName: r.campaign_name.slice(0, 300),
            currency: r.account_currency ?? "USD",
            spendCents: Math.round(Number(r.spend ?? 0) * 100),
            impressions: Number(r.impressions ?? 0),
            clicks: Number(r.clicks ?? 0),
            linkClicks: Number(r.inline_link_clicks ?? 0),
            metaPurchases: Math.round(pick(r.actions)),
            metaPurchaseValue: Math.round(pick(r.action_values) * 100),
          };
          await db.adSpendDaily.upsert({
            where: { date_accountId_campaignId: { date: r.date_start, accountId: acc, campaignId: r.campaign_id } },
            update: data,
            create: { date: r.date_start, accountId: acc, campaignId: r.campaign_id, ...data },
          });
          rows++;
        }
        url = json.paging?.next ?? null;
      }
      result[acc] = rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result[acc] = `erro: ${message}`.slice(0, 200);
      log.error("ads", "falha ao importar gastos", { account: acc, error: message.slice(0, 200) });
    }
  }
  await syncFxRates(since, until).catch((e) => log.error("ads", "falha na cotação", { error: e instanceof Error ? e.message : String(e) }));
  return { skipped: false as const, since, until, accounts: result };
}

/** Sincronização automática (no tick/cron), no máximo a cada 30 min. */
export async function maybeSyncAdSpend() {
  if (!adsToken()) return { skipped: true as const };
  const last = await db.adSpendDaily.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
  if (last && Date.now() - last.updatedAt.getTime() < 30 * 60_000) return { skipped: true as const };
  return syncAdSpend(3);
}

/** PTAX venda (Banco Central) — dias sem cotação usam o último dia útil anterior. */
export async function syncFxRates(since: string, until: string) {
  const fmt = (s: string) => `${s.slice(5, 7)}-${s.slice(8, 10)}-${s.slice(0, 4)}`;
  const start = addDays(since, -7); // cobre fins de semana/feriados no início do período
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@dataInicial='${fmt(start)}'&@dataFinalCotacao='${fmt(until)}'&$top=1000&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`PTAX HTTP ${res.status}`);
  const json = (await res.json()) as { value?: { cotacaoVenda: number; dataHoraCotacao: string }[] };
  const byDay = new Map((json.value ?? []).map((v) => [v.dataHoraCotacao.slice(0, 10), v.cotacaoVenda]));
  let last: number | null = null;
  for (let d = start; d <= until; d = addDays(d, 1)) {
    if (byDay.has(d)) last = byDay.get(d)!;
    if (last && d >= since) await db.fxRate.upsert({ where: { date: d }, update: { usdBrl: last }, create: { date: d, usdBrl: last } });
  }
}

export type FxConfig = { mode: "ptax" | "manual"; manualRate: number; feePct: number };
export function fxConfig(s: Settings): FxConfig {
  const n = (v: string | undefined, f: number) => {
    const x = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(x) && x >= 0 ? x : f;
  };
  return { mode: s.ads_fx_mode === "manual" ? "manual" : "ptax", manualRate: n(s.ads_fx_manual_rate, 0), feePct: n(s.ads_fx_fee_pct, 0) };
}

/** Relatório do período: gasto (USD e R$), vendas confirmadas e ROAS — total, por dia e por campanha. */
export async function adsReport(from: Date, to: Date) {
  const s = await getSettingsFresh();
  const fx = fxConfig(s);
  const sinceDay = spDate(from);
  const untilDay = spDate(new Date(to.getTime() - 1));
  const [spend, rates, orders] = await Promise.all([
    db.adSpendDaily.findMany({ where: { date: { gte: sinceDay, lte: untilDay } } }),
    db.fxRate.findMany({ where: { date: { gte: addDays(sinceDay, -7), lte: untilDay } }, orderBy: { date: "asc" } }),
    db.order.findMany({
      where: { status: { in: [...PAID_STATUSES] }, OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, approvedAt: { gte: from, lt: to } }] },
      select: { totalCents: true, paidAt: true, approvedAt: true, utmSource: true, utmCampaign: true, utmId: true, channel: true, paymentMethod: true },
    }),
  ]);
  const rateMap = new Map(rates.map((r) => [r.date, r.usdBrl]));
  const latestRate = rates.at(-1)?.usdBrl ?? null;
  const rateFor = (day: string) => {
    if (fx.mode === "manual" && fx.manualRate > 0) return fx.manualRate;
    for (let d = day, i = 0; i < 10; d = addDays(d, -1), i++) if (rateMap.has(d)) return rateMap.get(d)!;
    return latestRate;
  };
  const toBrl = (cents: number, currency: string, day: string) => {
    if (currency === "BRL") return cents;
    const r = rateFor(day);
    return r ? Math.round(cents * r * (1 + fx.feePct / 100)) : 0;
  };
  const isMeta = (o: { utmSource: string | null; channel: string | null }) => /facebook|instagram|meta|^fb$|^ig$/i.test(`${o.utmSource ?? ""} ${o.channel ?? ""}`);

  const days = new Map<string, { spendUsd: number; spendBrl: number; revenue: number; metaRevenue: number; sales: number; metaSales: number; rate: number | null }>();
  const day = (d: string) => days.get(d) ?? (days.set(d, { spendUsd: 0, spendBrl: 0, revenue: 0, metaRevenue: 0, sales: 0, metaSales: 0, rate: rateFor(d) }), days.get(d)!);
  const camps = new Map<string, { id: string; name: string; spendUsd: number; spendBrl: number; impressions: number; clicks: number; metaPurchases: number; sales: number; revenue: number }>();
  let missingRate = false;
  for (const r of spend) {
    const brl = toBrl(r.spendCents, r.currency, r.date);
    if (r.currency !== "BRL" && !rateFor(r.date)) missingRate = true;
    const dd = day(r.date);
    dd.spendUsd += r.currency === "BRL" ? 0 : r.spendCents;
    dd.spendBrl += brl;
    const c = camps.get(r.campaignId) ?? { id: r.campaignId, name: r.campaignName, spendUsd: 0, spendBrl: 0, impressions: 0, clicks: 0, metaPurchases: 0, sales: 0, revenue: 0 };
    c.spendUsd += r.currency === "BRL" ? 0 : r.spendCents;
    c.spendBrl += brl;
    c.impressions += r.impressions;
    c.clicks += r.linkClicks || r.clicks;
    c.metaPurchases += r.metaPurchases;
    c.name = r.campaignName;
    camps.set(r.campaignId, c);
  }
  const byName = new Map([...camps.values()].map((c) => [c.name.trim().toLowerCase(), c]));
  let unmatchedMeta = { sales: 0, revenue: 0 };
  for (const o of orders) {
    const d = spDate(o.paidAt ?? o.approvedAt!);
    const dd = day(d);
    dd.revenue += o.totalCents;
    dd.sales++;
    if (isMeta(o)) {
      dd.metaRevenue += o.totalCents;
      dd.metaSales++;
      const c = (o.utmId && camps.get(o.utmId)) || (o.utmCampaign && byName.get(o.utmCampaign.trim().toLowerCase())) || null;
      if (c) {
        c.sales++;
        c.revenue += o.totalCents;
      } else unmatchedMeta = { sales: unmatchedMeta.sales + 1, revenue: unmatchedMeta.revenue + o.totalCents };
    }
  }
  const sum = (k: "spendUsd" | "spendBrl" | "revenue" | "metaRevenue" | "sales" | "metaSales") => [...days.values()].reduce((a, d) => a + d[k], 0);
  const totals = { spendUsd: sum("spendUsd"), spendBrl: sum("spendBrl"), revenue: sum("revenue"), metaRevenue: sum("metaRevenue"), sales: sum("sales"), metaSales: sum("metaSales") };
  const roas = (rev: number, sp: number) => (sp > 0 ? rev / sp : null);
  return {
    fx,
    missingRate,
    connected: Boolean(adsToken()) && adAccountIds(s).length > 0,
    lastSync: (await db.adSpendDaily.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null,
    totals: {
      ...totals,
      avgRate: totals.spendUsd > 0 ? totals.spendBrl / totals.spendUsd / (1 + fx.feePct / 100) : rateFor(untilDay),
      roasMeta: roas(totals.metaRevenue, totals.spendBrl),
      roasTotal: roas(totals.revenue, totals.spendBrl),
      cpaMeta: totals.metaSales ? Math.round(totals.spendBrl / totals.metaSales) : null,
    },
    daily: [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, d]) => ({ date, ...d, roas: roas(d.metaRevenue, d.spendBrl) })),
    campaigns: [...camps.values()].sort((a, b) => b.spendBrl - a.spendBrl).map((c) => ({ ...c, roas: roas(c.revenue, c.spendBrl), cpa: c.sales ? Math.round(c.spendBrl / c.sales) : null })),
    unmatchedMeta,
  };
}
