import { PageHeader, Pagination, inputCls, btnPrimary } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/utils/format";

export const metadata = { title: "Auditoria" };
const PER_PAGE = 50;

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return null;
  const fmt = (v: unknown) => (v == null ? "—" : typeof v === "string" ? v.slice(0, 120) : JSON.stringify(v).slice(0, 120));
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
      {keys.slice(0, 12).map((k) => (
        <li key={k}>
          <code>{k}</code>: <span className="text-red-600 line-through">{fmt(b[k])}</span> → <span className="text-emerald-700">{fmt(a[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() ?? "";
  const where = q
    ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { summary: { contains: q, mode: "insensitive" as const } }, { entity: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const [logs, count] = await Promise.all([
    db.auditLog.findMany({ where, include: { admin: { select: { email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.auditLog.count({ where }),
  ]);
  return (
    <div>
      <PageHeader title="Auditoria" description="Todas as alterações administrativas: quem, o quê, valor anterior e novo." />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Filtrar por ação, entidade ou texto" className={`${inputCls} max-w-sm`} />
        <button className={btnPrimary}>Filtrar</button>
      </form>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {logs.map((l) => (
          <li key={l.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-slate-400">{formatDate(l.createdAt, true)}</span>
              <span className="font-medium">{l.admin?.email ?? "sistema"}</span>
              <code className="rounded bg-slate-100 px-1.5 text-xs">{l.action}</code>
              {l.entity && <span className="text-xs text-slate-500">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 12)}` : ""}</span>}
              {l.ipHash && <span className="text-xs text-slate-400">IP#{l.ipHash.slice(0, 8)}</span>}
            </div>
            {l.summary && <p className="mt-0.5 text-slate-700">{l.summary}</p>}
            <Diff before={l.before} after={l.after} />
          </li>
        ))}
        {!logs.length && <li className="px-4 py-10 text-center text-sm text-slate-500">Nenhum registro.</li>}
      </ul>
      <Pagination page={page} pages={Math.ceil(count / PER_PAGE)} makeHref={(p) => `?${new URLSearchParams({ q, page: String(p) })}`} />
    </div>
  );
}
