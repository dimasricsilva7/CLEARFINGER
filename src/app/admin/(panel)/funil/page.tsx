import { Card, PageHeader, Stat, inputCls, btnPrimary } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { int, pct } from "@/components/admin/format";
import { formatBRL } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { funnel, funnelByDay, funnelFilterOptions } from "@/server/admin/reports";
import { FUNNEL_STEPS } from "@/lib/domain";

export const metadata = { title: "Funil" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FunnelPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const filters = { source: str("origem"), campaign: str("campanha"), device: str("dispositivo") };
  const [f, daily, opts] = await Promise.all([funnel(p, filters), funnelByDay(p, filters), funnelFilterOptions()]);
  const max = Math.max(1, f.steps[0]?.value ?? 1);

  return (
    <div>
      <PageHeader title="Funil" description="Sessões que chegaram a cada etapa (tracking próprio). Pedido e compra são confirmados no servidor." actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />} />
      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {["periodo", "de", "ate"].map((k) => str(k) && <input key={k} type="hidden" name={k} value={str(k)} />)}
        <select name="origem" defaultValue={filters.source ?? ""} className={inputCls} aria-label="Origem">
          <option value="">Todas as origens</option>
          {opts.sources.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select name="campanha" defaultValue={filters.campaign ?? ""} className={inputCls} aria-label="Campanha">
          <option value="">Todas as campanhas</option>
          {opts.campaigns.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select name="dispositivo" defaultValue={filters.device ?? ""} className={inputCls} aria-label="Dispositivo">
          <option value="">Todos os dispositivos</option>
          {opts.devices.map((o) => <option key={o}>{o}</option>)}
        </select>
        <button className={btnPrimary}>Aplicar filtros</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visitantes (sessões)" value={int(f.steps[0]?.value ?? 0)} />
        <Stat label="Checkout" value={int(f.steps.find((s) => s.key === "checkout")?.value ?? 0)} />
        <Stat label="PIX pagos" value={int(f.pix.sales)} hint={`Conversão ${pct(f.pix.conversion, 2)} · Receita ${formatBRL(f.pix.revenue)}`} />
        <Stat label="Crediários aprovados" value={int(f.crediario.sales)} hint={`Conversão ${pct(f.crediario.conversion, 2)} · Receita ${formatBRL(f.crediario.revenue)}`} />
      </div>

      <Card title={`Até o checkout · ${p.label}`}>
        <StepList steps={f.common} max={max} />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Trilha PIX" actions={<span className="text-xs text-slate-500">conversão {pct(f.pix.conversion, 2)} · {pct(f.pix.fromCheckout, 1)} do checkout</span>}>
          <StepList steps={f.pix.steps} max={max} />
          <p className="mt-3 text-xs text-slate-500">PIX pago = confirmado pelo gateway (webhook ou consulta).</p>
        </Card>
        <Card title="Trilha Crediário" actions={<span className="text-xs text-slate-500">conversão {pct(f.crediario.conversion, 2)} · {pct(f.crediario.fromCheckout, 1)} do checkout</span>}>
          <StepList steps={f.crediario.steps} max={max} />
          <p className="mt-3 text-xs text-slate-500">Crediário aprovado = aprovado manualmente no admin.</p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title={`Funil por dia · ${p.label}`}>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 bg-white py-2 pr-3">Dia</th>
                  {FUNNEL_STEPS.map((s) => <th key={s.key} className={`px-2 py-2 text-right font-semibold ${s.group === "PIX" ? "text-blue-700" : s.group === "CREDIARIO" ? "text-violet-700" : ""}`}>{s.group === "common" ? "" : s.group === "PIX" ? "PIX · " : "Cred. · "}{s.label}</th>)}
                  <th className="px-2 py-2 text-right font-semibold text-blue-700">Conv. PIX</th>
                  <th className="px-2 py-2 text-right font-semibold text-violet-700">Conv. crediário</th>
                  <th className="py-2 pl-2 text-right font-semibold">Receita</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.day} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="sticky left-0 whitespace-nowrap bg-white py-2 pr-3 font-semibold capitalize text-slate-800">{new Date(`${d.day}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}</td>
                    {d.values.map((v, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${v ? "text-slate-900" : "text-slate-300"}`}>{int(v)}</td>)}
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{pct(d.conversionPix, 2)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{pct(d.conversionCred, 2)}</td>
                    <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatBRL(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

type Step = { key: string; label: string; value: number; pctOfFirst: number; fromPrev: number };
function StepList({ steps, max }: { steps: Step[]; max: number }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-800">{s.label}</span>
            <span className="tabular-nums text-slate-600">
              <b className="text-slate-900">{int(s.value)}</b> · {pct(s.pctOfFirst)} do total
              {s.key !== "visitors" && <span className={s.fromPrev < 0.5 ? " text-red-600" : " text-emerald-700"}> · {pct(s.fromPrev)} da etapa anterior</span>}
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#1F6FD1]" style={{ width: `${(s.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
