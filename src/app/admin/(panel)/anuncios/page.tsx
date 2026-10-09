import { Badge, Card, Field, PageHeader, Stat, inputCls } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { int } from "@/components/admin/format";
import { formatBRL, formatDate } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { adsReport, adsToken } from "@/server/ads";
import { getSettingsFresh } from "@/server/settings";
import { saveSettings, syncAdsNow } from "../sistema-actions";

export const metadata = { title: "Anúncios e ROAS" };
type SP = Promise<Record<string, string | string[] | undefined>>;

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const x = (v: number | null) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")}x`);
const roasTone = (v: number | null) => (v == null ? "text-slate-400" : v >= 2 ? "text-emerald-700" : v >= 1 ? "text-amber-700" : "text-red-600");

export default async function AdsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const [r, s] = await Promise.all([adsReport(p.from, p.to), getSettingsFresh()]);
  const t = r.totals;

  return (
    <div>
      <PageHeader
        title="Anúncios e ROAS"
        description="Gasto da Meta (em dólar) convertido para reais pela cotação de cada dia + IOF, comparado com as vendas confirmadas do site (PIX pago e crediário aprovado)."
        actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />}
      />

      {!r.connected && (
        <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {!adsToken() ? "Falta conectar a conta: cadastre o token da Meta (META_ADS_ACCESS_TOKEN, permissão ads_read) na Vercel e informe o ID da conta abaixo." : "Informe o ID da conta de anúncios abaixo."}
        </p>
      )}
      {r.missingRate && <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Há dias sem cotação do dólar importada — clique em “Atualizar agora”.</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gasto (dólar)" value={usd(t.spendUsd)} hint={t.avgRate ? `cotação média R$ ${t.avgRate.toFixed(4).replace(".", ",")}` : undefined} />
        <Stat label="Gasto em reais" value={formatBRL(t.spendBrl)} hint={`com ${String(r.fx.feePct).replace(".", ",")}% de IOF/taxa${r.fx.mode === "manual" ? " · cotação manual" : " · PTAX do dia"}`} />
        <Stat label="Vendas vindas da Meta" value={formatBRL(t.metaRevenue)} hint={`${int(t.metaSales)} venda(s) · CPA ${t.cpaMeta != null ? formatBRL(t.cpaMeta) : "—"}`} />
        <Stat label="ROAS (Meta)" value={x(t.roasMeta)} hint={`ROAS geral (todas as vendas): ${x(t.roasTotal)}`} />
      </div>

      <Card title="Por campanha" actions={<span className="text-xs text-slate-500">{r.lastSync ? `atualizado ${formatDate(r.lastSync, true)}` : "ainda não importado"}</span>}>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Campanha</th>
                <th className="px-2 py-2 text-right">Gasto US$</th>
                <th className="px-2 py-2 text-right">Gasto R$</th>
                <th className="px-2 py-2 text-right">Cliques</th>
                <th className="px-2 py-2 text-right">Vendas (site)</th>
                <th className="px-2 py-2 text-right">Compras (Meta)</th>
                <th className="px-2 py-2 text-right">Receita R$</th>
                <th className="px-2 py-2 text-right">CPA</th>
                <th className="py-2 pl-2 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {r.campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-[280px] py-2 pr-3"><p className="truncate font-semibold text-slate-800">{c.name}</p><p className="font-mono text-[11px] text-slate-400">{c.id}</p></td>
                  <td className="px-2 py-2 text-right tabular-nums">{usd(c.spendUsd)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBRL(c.spendBrl)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{int(c.clicks)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{int(c.sales)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-500">{int(c.metaPurchases)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBRL(c.revenue)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.cpa != null ? formatBRL(c.cpa) : "—"}</td>
                  <td className={`py-2 pl-2 text-right font-bold tabular-nums ${roasTone(c.roas)}`}>{x(c.roas)}</td>
                </tr>
              ))}
              {!r.campaigns.length && (
                <tr><td colSpan={9} className="py-6 text-center text-slate-500">Nenhum gasto importado neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {r.unmatchedMeta.sales > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {int(r.unmatchedMeta.sales)} venda(s) da Meta ({formatBRL(r.unmatchedMeta.revenue)}) sem campanha identificada — use os parâmetros de URL recomendados abaixo para casar todas as vendas.
          </p>
        )}
      </Card>

      <div className="mt-6">
        <Card title="Por dia">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Dia</th>
                  <th className="px-2 py-2 text-right">Cotação</th>
                  <th className="px-2 py-2 text-right">Gasto US$</th>
                  <th className="px-2 py-2 text-right">Gasto R$</th>
                  <th className="px-2 py-2 text-right">Vendas Meta</th>
                  <th className="px-2 py-2 text-right">Receita Meta</th>
                  <th className="px-2 py-2 text-right">Receita total</th>
                  <th className="py-2 pl-2 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {r.daily.map((d) => (
                  <tr key={d.date} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 font-semibold capitalize">{new Date(`${d.date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{d.rate ? d.rate.toFixed(4).replace(".", ",") : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{usd(d.spendUsd)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatBRL(d.spendBrl)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{int(d.metaSales)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatBRL(d.metaRevenue)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{formatBRL(d.revenue)}</td>
                    <td className={`py-2 pl-2 text-right font-bold tabular-nums ${roasTone(d.roas)}`}>{x(d.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Conexão e conversão" actions={r.connected ? <Badge tone="green">conectado</Badge> : <Badge tone="amber">não conectado</Badge>}>
          <ActionForm action={saveSettings} className="space-y-4">
            <input type="hidden" name="__keys" value="ads_account_ids,ads_campaign_filter,ads_fx_mode,ads_fx_manual_rate,ads_fx_fee_pct" />
            <Field label="IDs das contas de anúncios (Meta)" hint="Só números, separados por vírgula. Ex.: 1800271297818384, 2608047479647175">
              <input name="ads_account_ids" defaultValue={s.ads_account_ids} className={inputCls} />
            </Field>
            <Field label="Considerar só campanhas com estas palavras no nome" hint="Ex.: CLEARFINGER. Separe por vírgula. Vazio = todas as campanhas da conta (inclusive de outras lojas).">
              <input name="ads_campaign_filter" defaultValue={s.ads_campaign_filter} placeholder="CLEARFINGER" className={inputCls} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Cotação do dólar">
                <select name="ads_fx_mode" defaultValue={s.ads_fx_mode} className={inputCls}>
                  <option value="ptax">PTAX do dia (Banco Central)</option>
                  <option value="manual">Valor fixo (manual)</option>
                </select>
              </Field>
              <Field label="Cotação manual (R$)" hint="Usada só no modo manual"><input name="ads_fx_manual_rate" defaultValue={s.ads_fx_manual_rate} placeholder="5,35" className={inputCls} /></Field>
              <Field label="IOF / taxa do cartão (%)" hint="Confira na fatura do cartão"><input name="ads_fx_fee_pct" defaultValue={s.ads_fx_fee_pct} className={inputCls} /></Field>
            </div>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
          <ActionForm action={syncAdsNow} className="mt-4 border-t border-slate-100 pt-4">
            <SubmitButton pendingText="Importando…">Atualizar agora (últimos 30 dias)</SubmitButton>
            <p className="mt-1 text-xs text-slate-500">Também atualiza sozinho a cada 30 min (últimos 3 dias).</p>
          </ActionForm>
        </Card>
        <Card title="Parâmetros de URL dos anúncios">
          <p className="text-sm text-slate-600">No Gerenciador de Anúncios, em cada anúncio → <b>Parâmetros de URL</b>, cole:</p>
          <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}&amp;utm_content={"{{ad.name}}"}&amp;utm_term={"{{adset.name}}"}&amp;utm_id={"{{campaign.id}}"}</pre>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li><b>utm_id</b> liga cada venda ao gasto da campanha mesmo que você renomeie a campanha.</li>
            <li>Vendas com origem facebook/instagram sem campanha identificada entram no ROAS da Meta, mas não em uma campanha específica.</li>
            <li>“ROAS (Meta)” usa só as vendas vindas da Meta; “ROAS geral” divide todas as vendas confirmadas do site pelo gasto.</li>
            <li>As datas do gasto seguem o fuso da conta de anúncios; as vendas, o horário de Brasília.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
