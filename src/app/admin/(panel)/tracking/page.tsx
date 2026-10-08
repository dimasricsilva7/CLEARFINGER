import Link from "next/link";
import { Badge, Card, PageHeader, btnSecondary } from "@/components/admin/ui";
import { OnlineNow } from "@/components/admin/OnlineNow";
import { Table } from "@/components/admin/Table";
import { db } from "@/lib/db";
import { getSettingsFresh, googleIds, isOn, trackingIds } from "@/server/settings";
import { formatBRL, formatDate } from "@/utils/format";

export const metadata = { title: "Tracking" };
export const dynamic = "force-dynamic";

const dur = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m ? `${m} min ${s}s` : `${s}s`;
};

export default async function TrackingPage() {
  const [s, online, events, counts] = await Promise.all([
    getSettingsFresh(),
    db.visitorSession.findMany({ where: { lastSeenAt: { gte: new Date(Date.now() - 90_000) }, NOT: { device: "servidor" } }, orderBy: { lastSeenAt: "desc" }, take: 100 }),
    db.trackingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 60, select: { id: true, name: true, element: true, path: true, valueCents: true, device: true, utmSource: true, createdAt: true } }),
    db.trackingEvent.groupBy({ by: ["name"], where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } }, _count: true, orderBy: { _count: { name: "desc" } } }),
  ]);
  const ids = trackingIds(s);
  const g = googleIds(s);
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title="Tracking" description="Tracking próprio (primeira parte), visitantes online e status das tags. Dados do crediário nunca entram em eventos." actions={<Link href="/admin/configuracoes?aba=rastreamento" className={btnSecondary}>Configurar Meta / Google</Link>} />

      <Card title="Tags">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>Meta Pixel: {ids.metaPixelIds.length ? <Badge tone="green">{ids.metaPixelIds.join(", ")}</Badge> : <Badge>não configurado</Badge>}</li>
          <li>Conversions API: {ids.capiEnabled ? <Badge tone="green">ativa</Badge> : <Badge>inativa</Badge>}</li>
          <li>GA4: {ids.gaId ? <Badge tone="green">{ids.gaId}</Badge> : <Badge>não configurado</Badge>}</li>
          <li>Google Ads: {g.adsId ? <Badge tone="green">{g.adsId}{g.adsPurchaseLabel ? " · conversão de compra" : ""}</Badge> : <Badge>não configurado</Badge>}</li>
          <li>GTM: {g.gtmId ? <Badge tone="green">{g.gtmId}</Badge> : <Badge>não configurado</Badge>}</li>
          <li>Aviso de cookies: {isOn(s.cookie_banner_enabled) ? <Badge tone="green">ativo</Badge> : <Badge>desligado</Badge>}</li>
        </ul>
      </Card>

      <OnlineNow />

      <Card title={`Sessões online agora (${online.length})`}>
        <Table
          rows={online}
          rowKey={(r) => r.id}
          empty="Ninguém com o site aberto agora."
          columns={[
            { key: "p", label: "Página atual", render: (r) => <span className="block max-w-[220px] truncate">{r.exitPage?.split("?")[0] || "/"}</span> },
            { key: "d", label: "Dispositivo", render: (r) => `${r.device ?? "—"} · ${r.browser ?? ""}` },
            { key: "o", label: "Origem", render: (r) => r.utmSource ?? r.channel ?? "direto" },
            { key: "c", label: "Campanha", render: (r) => <span className="block max-w-[180px] truncate">{r.utmCampaign ?? "—"}</span> },
            { key: "t", label: "Tempo de sessão", align: "right", render: (r) => dur(now - r.firstSeenAt.getTime()) },
            { key: "v", label: "Páginas", align: "right", render: (r) => r.pageViews },
          ]}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card title="Eventos nas últimas 24h">
          <ul className="space-y-1 text-sm">
            {counts.map((c) => (
              <li key={c.name} className="flex justify-between"><code className="text-xs">{c.name}</code><b className="tabular-nums">{c._count}</b></li>
            ))}
            {!counts.length && <li className="text-slate-500">Nenhum evento ainda.</li>}
          </ul>
        </Card>
        <Card title="Últimos eventos">
          <ol className="max-h-[28rem] space-y-1 overflow-y-auto text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3">
                <span className="w-28 shrink-0 text-slate-400">{formatDate(e.createdAt, true)}</span>
                <b className="font-medium">{e.name}</b>
                <span className="text-slate-500">{e.element ?? e.path?.split("?")[0]}</span>
                {e.valueCents != null && <span className="text-slate-500">{formatBRL(e.valueCents)}</span>}
                <span className="text-slate-400">{e.device} · {e.utmSource ?? "direto"}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
