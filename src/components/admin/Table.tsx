export type Column<T> = { key: string; label: string; align?: "left" | "right"; render: (row: T) => React.ReactNode };

/** Tabela responsiva do admin (rolagem horizontal no celular). */
export function Table<T>({ columns, rows, empty = "Sem dados no período.", rowKey }: { columns: Column<T>[]; rows: T[]; empty?: string; rowKey: (row: T, i: number) => string }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
