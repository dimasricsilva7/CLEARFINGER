"use client";

import { useEffect, useState } from "react";

type Row = { label: string; n: number };
type Data = { online: number; pages: Row[]; sources: Row[]; devices: Row[]; at: string };

/** "Online agora": visitantes com a aba do site aberta (atualiza a cada 15 s). */
export function OnlineNow() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/online", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as Data;
        if (!stop) {
          setData(json);
          setError(false);
        }
      } catch {
        if (!stop) setError(true);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const online = data?.online ?? 0;
  const list = (title: string, rows: Row[] | undefined) =>
    rows && rows.length > 0 ? (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-3">
              <span className="truncate text-slate-700">{r.label}</span>
              <b className="tabular-nums text-slate-900">{r.n}</b>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${online > 0 ? "animate-ping bg-emerald-400" : ""}`} />
            <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${online > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Online agora</p>
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {data ? online : "…"} <span className="text-sm font-medium text-slate-500">{online === 1 ? "pessoa no site" : "pessoas no site"}</span>
            </p>
          </div>
        </div>
        {online > 0 && (
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            {list("Onde estão", data?.pages)}
            {list("Origem", data?.sources)}
            {list("Dispositivo", data?.devices)}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {error ? "Não foi possível atualizar agora — tentando de novo." : "Atualiza a cada 15 s · conta quem está com o site aberto na tela (últimos 90 s)."}
      </p>
    </section>
  );
}
