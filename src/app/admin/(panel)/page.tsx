import Link from "next/link";
import { Card, PageHeader, Stat } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { OnlineNow } from "@/components/admin/OnlineNow";
import { DayBars, HBars } from "@/components/admin/charts";
import { int, pct } from "@/components/admin/format";
import { bravopayMode, envHealth } from "@/lib/env";
import { formatBRL } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { dashboard, funnel } from "@/server/admin/reports";

export const metadata = { title: "Dashboard" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const p = resolvePeriod(await searchParams);
  const [d, f] = await Promise.all([dashboard(p), funnel(p)]);
  const missing = envHealth().filter((e) => e.required && !e.ok);
  const mode = bravopayMode();
  const q = `periodo=${p.key}&de=${p.fromInput}&ate=${p.toInput}`;

  return (
    <div>
      <PageHeader title="Dashboard" description={`${p.label} · vendas confirmadas = PIX pago + crediário aprovado`} actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />} />

      {(missing.length > 0 || mode !== "live") && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{mode === "mock" ? "Modo de teste da BravoPay ativo (PIX fictício)." : mode === "disabled" ? "PIX desativado: configure a BravoPay (o crediário continua funcionando)." : "Configuração pendente."}</p>
          {missing.length > 0 && <p className="mt-1">Variáveis ausentes: {missing.map((m) => m.key).join(", ")}.</p>}
          <Link href="/admin/configuracoes?aba=sistema" className="mt-1 inline-block font-semibold underline">Ver diagnóstico</Link>
        </div>
      )}

      <OnlineNow />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visitantes" value={int(d.visitors)} />
        <Stat label="Pedidos" value={int(d.orders)} hint={`${d.pix.orders} PIX · ${d.crediario.orders} crediário`} />
        <Stat label="Pedidos pagos / aprovados" value={int(d.sold)} hint={`${d.pix.paid} PIX · ${d.crediario.approved} crediário`} />
        <Stat label="Receita" value={formatBRL(d.revenue)} />
        <Stat label="Ticket médio" value={formatBRL(Math.round(d.aov))} />
        <Stat label="Conversão" value={pct(d.conversion, 2)} hint="vendas ÷ visitantes" />
        <Stat label="PIX" value={formatBRL(d.pix.revenue)} hint={`${d.pix.paid} pago(s) · taxa ${pct(d.pix.paymentRate)}`} />
        <Stat label="Crediário" value={formatBRL(d.crediario.revenue)} hint={`${d.crediario.approved} aprovado(s) de ${d.crediario.orders}`} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="PIX" actions={<Link href={`/admin/pedidos?metodo=PIX&${q}`} className="text-xs font-semibold text-slate-600 hover:underline">Ver pedidos →</Link>}>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[["Pedidos PIX", d.pix.orders], ["PIX gerado", d.pix.generated], ["PIX pendente", d.pix.pending], ["PIX pago", d.pix.paid], ["PIX expirado", d.pix.expired], ["Aguardando agora", d.pix.pendingNow]].map(([l, v]) => (
              <div key={l as string}><dt className="text-xs text-slate-500">{l}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Crediário" actions={<Link href={`/admin/pedidos?metodo=CREDIARIO&${q}`} className="text-xs font-semibold text-slate-600 hover:underline">Ver pedidos →</Link>}>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[["Pedidos crediário", d.crediario.orders], ["Pendente", d.crediario.pending], ["Em análise", d.crediario.review], ["Aprovado", d.crediario.approved], ["Recusado", d.crediario.rejected], ["Cancelado", d.crediario.cancelled]].map(([l, v]) => (
              <div key={l as string}><dt className="text-xs text-slate-500">{l}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Receita por dia"><DayBars data={d.daily.revenue} series={["Receita"]} format="brlShort" /></Card>
        <Card title="Vendas confirmadas por dia"><DayBars data={d.daily.confirmed} series={["PIX pago", "Crediário aprovado"]} /></Card>
        <Card title="Visitantes e checkout por dia"><DayBars data={d.daily.visitors} series={["Visitantes", "Checkout iniciado"]} /></Card>
        <Card title="Pedidos por método"><DayBars data={d.daily.methods} series={["PIX", "Crediário"]} /></Card>
        <Card title="Conversão por dia"><DayBars data={d.daily.conversion} series={["Vendas ÷ visitantes"]} format="bps" /></Card>
        <Card title="Funil do período" actions={<Link href={`/admin/funil?${q}`} className="text-xs font-semibold text-slate-600 hover:underline">Detalhar →</Link>}>
          <HBars rows={f.common.map((s) => ({ label: s.label, value: s.value, sub: s.pctOfFirst ? pct(s.pctOfFirst) : undefined }))} />
          <div className="mt-5 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {([["PIX", f.pix], ["Crediário", f.crediario]] as const).map(([label, b]) => (
              <div key={label}>
                <p className="mb-2 flex items-baseline justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>{label}</span>
                  <span className="normal-case tracking-normal text-slate-600">conversão <b className="text-slate-900">{pct(b.conversion, 2)}</b></span>
                </p>
                <HBars rows={b.steps.map((s) => ({ label: s.label, value: s.value, sub: s.pctOfFirst ? pct(s.pctOfFirst) : undefined }))} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Vendas por oferta"><HBars rows={d.byOffer} format="brl" /></Card>
        <Card title="Vendas por origem"><HBars rows={d.byChannel} format="brl" /></Card>
        <Card title="Vendas por campanha"><HBars rows={d.byCampaign} format="brl" /></Card>
        <Card title="Vendas por dispositivo"><HBars rows={d.byDevice} format="brl" /></Card>
      </div>
    </div>
  );
}
