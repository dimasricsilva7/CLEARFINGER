import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, PageHeader, Pagination, Stat, inputCls, btnPrimary } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { RowActions } from "@/components/admin/RowActions";
import { int, pct } from "@/components/admin/format";
import { ORDER_STATUS_LABEL } from "@/lib/domain";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email/provider";
import { formatBRL, formatDate, formatPhone } from "@/utils/format";
import { resolvePeriod } from "@/server/admin/period";
import { leadRecoveryUrl } from "@/lib/email";
import { getSettings } from "@/server/settings";
import { deleteLead, sendLeadEmailAction } from "./actions";

export const metadata = { title: "Checkouts abandonados" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const PER_PAGE = 50;

const EMAIL_LABEL: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  SCHEDULED: { label: "agendado", tone: "amber" },
  SENDING: { label: "enviando", tone: "amber" },
  SENT: { label: "enviado", tone: "green" },
  FAILED: { label: "falhou", tone: "red" },
  SKIPPED: { label: "não enviado", tone: "slate" },
  CANCELLED: { label: "cancelado", tone: "slate" },
};

export default async function CheckoutsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const view = sp.ver === "convertidos" ? "convertidos" : sp.ver === "todos" ? "todos" : "abandonados";
  const page = Math.max(1, Number(sp.page) || 1);

  const base: Prisma.CheckoutLeadWhereInput = { createdAt: { gte: p.from, lt: p.to } };
  const where: Prisma.CheckoutLeadWhereInput = {
    ...base,
    ...(view === "abandonados" ? { orderId: null } : view === "convertidos" ? { orderId: { not: null } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
  };
  const [leads, count, total, converted, emailed, recovered, settings] = await Promise.all([
    db.checkoutLead.findMany({ where, include: { order: { select: { id: true, orderNumber: true, status: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.checkoutLead.count({ where }),
    db.checkoutLead.count({ where: base }),
    db.checkoutLead.count({ where: { ...base, orderId: { not: null } } }),
    db.checkoutLead.count({ where: { ...base, emailSentAt: { not: null } } }),
    db.checkoutLead.count({ where: { ...base, emailSentAt: { not: null }, order: { status: { in: ["PAID", "CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"] } } } }),
    getSettings(),
  ]);
  const abandonedValue = await db.checkoutLead.aggregate({ where: { ...base, orderId: null }, _sum: { totalCents: true } });
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>), ...extra }).toString();
  const store = settings.store_name || "CLEARFINGER";

  return (
    <div>
      <PageHeader
        title="Checkouts abandonados"
        description="Pessoas que abriram o checkout e digitaram e-mail ou WhatsApp. Quem não finaliza recebe um e-mail automático com o kit e os dados já preenchidos."
        actions={<PeriodFilter current={p.key} from={p.fromInput} to={p.toInput} />}
      />
      {emailProvider() === "none" && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Envio de e-mails desativado: configure RESEND_API_KEY e EMAIL_FROM na Vercel.</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checkouts com contato" value={int(total)} hint={p.label} />
        <Stat label="Abandonados" value={int(total - converted)} hint={`${formatBRL(abandonedValue._sum.totalCents ?? 0)} em carrinhos`} />
        <Stat label="Viraram pedido" value={int(converted)} hint={pct(total ? converted / total : 0)} />
        <Stat label="E-mails de recuperação" value={int(emailed)} hint={`${int(recovered)} pago(s) depois do e-mail`} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        {["periodo", "de", "ate"].map((k) => typeof sp[k] === "string" && <input key={k} type="hidden" name={k} value={sp[k] as string} />)}
        <select name="ver" defaultValue={view} className={`${inputCls} w-auto`} aria-label="Mostrar">
          <option value="abandonados">Só abandonados</option>
          <option value="convertidos">Só os que viraram pedido</option>
          <option value="todos">Todos</option>
        </select>
        <input name="q" defaultValue={q} placeholder="Buscar nome, e-mail ou WhatsApp" className={`${inputCls} max-w-xs`} />
        <button className={btnPrimary}>Filtrar</button>
      </form>

      <Table
        rows={leads}
        rowKey={(l) => l.id}
        empty="Nenhum checkout com contato neste período."
        columns={[
          { key: "d", label: "Data e hora", render: (l) => <span className="whitespace-nowrap">{formatDate(l.createdAt, true)}</span> },
          {
            key: "n",
            label: "Cliente",
            render: (l) => (
              <div className="min-w-[160px]">
                <p className="font-semibold">{l.name || "—"}</p>
                {l.email && <p className="max-w-[220px] truncate text-xs text-slate-600">{l.email}</p>}
                {l.phone && <p className="text-xs text-slate-600">{formatPhone(l.phone)}</p>}
              </div>
            ),
          },
          { key: "c", label: "Kit escolhido", render: (l) => <span className="block max-w-[260px] text-xs">{l.itemsSummary || "—"}{l.paymentMethod ? <span className="block text-slate-400">método: {l.paymentMethod === "PIX" ? "PIX" : "Crediário"}</span> : null}</span> },
          { key: "v", label: "Valor", align: "right", render: (l) => formatBRL(l.totalCents) },
          {
            key: "s",
            label: "Situação",
            render: (l) =>
              l.order ? (
                <Link href={`/admin/pedidos/${l.order.id}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                  {l.order.orderNumber} · {ORDER_STATUS_LABEL[l.order.status]}
                </Link>
              ) : (
                <Badge tone="amber">abandonado</Badge>
              ),
          },
          {
            key: "e",
            label: "E-mail",
            render: (l) => {
              const st = l.emailStatus ? EMAIL_LABEL[l.emailStatus] : null;
              return (
                <div className="whitespace-nowrap text-xs">
                  {st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className="text-slate-400">—</span>}
                  <span className="block text-slate-500">
                    {l.emailSentAt ? formatDate(l.emailSentAt, true) : l.emailStatus === "SCHEDULED" && l.emailScheduledFor ? `para ${formatDate(l.emailScheduledFor, true)}` : ""}
                    {l.emailCount > 1 ? ` · ${l.emailCount}x` : ""}
                  </span>
                  {l.emailError && l.emailStatus !== "SENT" && <span className="block max-w-[180px] whitespace-normal text-slate-400">{l.emailError}</span>}
                </div>
              );
            },
          },
          {
            key: "a",
            label: "Ações",
            render: (l) => {
              const first = l.name?.split(/\s+/)[0] ?? "";
              const msg = `Oi${first ? `, ${first}` : ""}! Aqui é da ${store}. Vi que você começou seu pedido do CLEARFINGER mas não finalizou. Deixei tudo preenchido aqui: ${leadRecoveryUrl(l.token)}`;
              const digits = (l.phone ?? "").replace(/\D/g, "");
              return (
                <div className="flex flex-col gap-1">
                  {digits.length >= 10 && !l.order && (
                    <a href={`https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" className="w-fit rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                      WhatsApp
                    </a>
                  )}
                  <RowActions id={l.id} primary={l.email && !l.order ? sendLeadEmailAction : undefined} primaryLabel={l.emailSentAt ? "Reenviar e-mail" : "Enviar e-mail"} onDelete={deleteLead} deleteConfirm="Excluir este registro de checkout?" />
                </div>
              );
            },
          },
        ]}
      />
      <Pagination page={page} pages={Math.ceil(count / PER_PAGE)} makeHref={(pg) => `?${qs({ page: String(pg) })}`} />
      <p className="mt-4 text-xs text-slate-500">
        O e-mail automático sai {settings.email_checkout_delay_minutes || 30} min depois da última digitação, só se a pessoa não gerar o pedido, e no máximo uma vez. Ative/desative em Configurações → E-mails.
      </p>
    </div>
  );
}
