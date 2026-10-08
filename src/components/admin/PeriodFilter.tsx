"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodFilter({ current, from, to }: { current: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState(current === "custom");
  const [de, setDe] = useState(from);
  const [ate, setAte] = useState(to);

  const go = (params: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    ["periodo", "de", "ate", "page"].forEach((k) => next.delete(k));
    Object.entries(params).forEach(([k, v]) => next.set(k, v));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Período">
        {OPTIONS.map((o) => {
          const active = o.key === "custom" ? custom : !custom && current === o.key;
          return (
            <button
              key={o.key}
              onClick={() => (o.key === "custom" ? setCustom(true) : (setCustom(false), go({ periodo: o.key })))}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ periodo: "custom", de, ate });
          }}
        >
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" aria-label="Data inicial" required />
          <span className="text-sm text-slate-500">a</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" aria-label="Data final" required />
          <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">Aplicar</button>
        </form>
      )}
    </div>
  );
}
