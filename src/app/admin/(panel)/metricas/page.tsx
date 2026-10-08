import Link from "next/link";
import { Card, PageHeader, Stat } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { Table } from "@/components/admin/Table";
import { int, pct } from "@/components/admin/format";
import { formatBRL } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { ACQ_DIMS, acquisition, paymentMetrics, type AcqDim } from "@/server/admin/reports";

export const metadata = { title: "Métricas" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function MetricsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const dim = (typeof sp.dim === "string" && sp.dim in ACQ_DIMS ? sp.dim : "utmCampaign") as AcqDim;
  const [m, acq] = await Promise.all([paymentMetrics(p), acquisition(p, dim)]);
  const base = `periodo=${p.key}&de=${p.fromInput}&ate=${p.toInput}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Métricas" description={`${p.label} · pagamentos e aquisição (UTMs)`} actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />} />

      <Card title="PIX">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="PIX gerado" value={int(m.pix.generated)} />
          <Stat label="PIX copiado" value={int(m.pix.copied)} hint="sessões que copiaram o código" />
          <Stat label="PIX pago" value={int(m.pix.paid)} hint={formatBRL(m.pix.revenue)} />
          <Stat label="PIX expirado" value={int(m.pix.expired)} hint={`${m.pix.pending} pendente(s) · ${m.pix.failed} falha(s)`} />
          <Stat label="Taxa de pagamento" value={pct(m.pix.paymentRate)} hint="pagos ÷ gerados" />
        </div>
      </Card>

      <Card title="Crediário">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Crediários iniciados" value={int(m.crediario.started)} hint="sessões que escolheram o crediário" />
          <Stat label="Protocolo preenchido" value={int(m.crediario.protocolCompleted)} />
          <Stat label="Dados concluídos" value={int(m.crediario.dataCompleted)} hint={`${m.crediario.installmentSelected} escolheram parcelas`} />
          <Stat label="Pedidos criados" value={int(m.crediario.orders)} hint={`conversão ${pct(m.crediario.startToOrder)} dos iniciados`} />
          <Stat label="Pendentes / em análise" value={`${m.crediario.pending} / ${m.crediario.review}`} />
          <Stat label="Aprovados" value={int(m.crediario.approved)} hint={formatBRL(m.crediario.revenue)} />
          <Stat label="Recusados" value={int(m.crediario.rejected)} />
          <Stat label="Cancelados" value={int(m.crediario.cancelled)} hint={`aprovação ${pct(m.crediario.approvalRate)}`} />
        </div>
      </Card>

      <Card title="Aquisição por UTM">
        <nav className="mb-4 flex flex-wrap gap-1.5">
          {Object.entries(ACQ_DIMS).map(([k, v]) => (
            <Link key={k} href={`?${base}&dim=${k}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${k === dim ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{v}</Link>
          ))}
        </nav>
        <Table
          rows={acq}
          rowKey={(r) => r.key}
          columns={[
            { key: "k", label: ACQ_DIMS[dim], render: (r) => <span className="block max-w-[260px] truncate font-medium">{r.key}</span> },
            { key: "v", label: "Visitantes", align: "right", render: (r) => int(r.visitors) },
            { key: "o", label: "Pedidos", align: "right", render: (r) => int(r.orders) },
            { key: "p", label: "PIX", align: "right", render: (r) => int(r.pix) },
            { key: "c", label: "Crediário", align: "right", render: (r) => int(r.cred) },
            { key: "s", label: "Vendas", align: "right", render: (r) => int(r.sold) },
            { key: "r", label: "Receita", align: "right", render: (r) => formatBRL(r.revenue) },
            { key: "cv", label: "Conversão", align: "right", render: (r) => pct(r.conversion, 2) },
          ]}
        />
      </Card>
    </div>
  );
}
