"use client";

import { useState } from "react";

/**
 * Gráficos SVG leves do admin (sem dependências). Paleta categórica validada
 * (ordem fixa): série 1 azul, série 2 laranja. Texto sempre em tokens de texto.
 */
export const SERIES = ["#2a78d6", "#eb6834"] as const;

export type FormatKey = "number" | "brl" | "brlShort" | "units" | "kits" | "bps";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FORMATS: Record<FormatKey, (n: number) => string> = {
  number: (n) => String(Math.round(n)),
  brl: (n) => brl.format(n / 100),
  brlShort: (n) => (n >= 100000 ? `R$ ${(n / 100000).toFixed(1).replace(".", ",")} mil` : brl.format(n / 100)),
  units: (n) => `${Math.round(n)} un.`,
  kits: (n) => `${Math.round(n)} kit(s)`,
  bps: (n) => `${(n / 100).toFixed(2).replace(".", ",")}%`,
};
const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Tooltip({ x, y, lines }: { x: number | string; y: number; lines: string[] }) {
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg" style={{ left: x, top: y - 8 }}>
      {lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-slate-200"}>
          {l}
        </div>
      ))}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs text-slate-500">
      <summary className="cursor-pointer select-none">Ver tabela</summary>
      <div className="mt-2 max-h-56 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr>{headers.map((h) => <th key={h} className="border-b border-slate-200 py-1 pr-3 font-semibold text-slate-700">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-slate-100 py-1 pr-3 tabular-nums">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Barras verticais por dia — 1 ou 2 séries (agrupadas). */
export function DayBars({
  data,
  series,
  format: fmtKey = "number",
}: {
  data: { day: string; values: number[] }[];
  series: string[];
  format?: FormatKey;
}) {
  const format = FORMATS[fmtKey];
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, PL = fmtKey.startsWith("brl") ? 78 : 40, PB = 26, PT = 10;
  const rawMax = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const integer = !fmtKey.startsWith("brl");
  const max = integer ? Math.max(2, Math.ceil(rawMax / 2) * 2) : rawMax;
  const slot = (W - PL) / Math.max(1, data.length);
  const nS = series.length;
  const barW = Math.max(2, Math.min(28, (slot - 6) / nS - 2));
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / max);
  const labelEvery = Math.ceil(data.length / 8);
  const empty = data.every((d) => d.values.every((v) => v === 0));

  return (
    <div>
      {nS > 1 && (
        <div className="mb-2 flex gap-4 text-xs text-slate-600">
          {series.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Gráfico: ${series.join(" e ")} por dia`} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PL} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PL - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {format(max * t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = PL + i * slot + (slot - (barW + 2) * nS) / 2;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={PL + i * slot} y={PT} width={slot} height={H - PT - PB} fill={hover === i ? "#f1f5f9" : "transparent"} />
                {d.values.map((v, s) => {
                  const h = Math.max(0, H - PB - y(v));
                  const r = Math.min(4, barW / 2, h);
                  const bx = x0 + s * (barW + 2);
                  return h > 0 ? (
                    <path key={s} d={`M${bx},${H - PB} V${H - PB - h + r} Q${bx},${H - PB - h} ${bx + r},${H - PB - h} H${bx + barW - r} Q${bx + barW},${H - PB - h} ${bx + barW},${H - PB - h + r} V${H - PB} Z`} fill={SERIES[s]} />
                  ) : null;
                })}
                {i % labelEvery === 0 && (
                  <text x={PL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                    {shortDay(d.day)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={PL} x2={W} y1={H - PB} y2={H - PB} stroke="#94a3b8" strokeWidth="1" />
        </svg>
        {hover !== null && data[hover] && (
          <Tooltip
            x={`${((PL + hover * slot + slot / 2) / W) * 100}%`}
            y={0}
            lines={[shortDay(data[hover].day), ...series.map((s, i) => `${s}: ${format(data[hover].values[i])}`)]}
          />
        )}
        {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Sem dados no período</p>}
      </div>
      <DataTable headers={["Dia", ...series]} rows={data.map((d) => [shortDay(d.day), ...d.values.map(format)])} />
    </div>
  );
}

/** Barras horizontais ranqueadas (produtos, cores, origens, funil). */
export function HBars({
  rows,
  format: fmtKey = "number",
  color = SERIES[0],
  empty = "Sem dados no período",
}: {
  rows: { label: string; value: number; swatch?: string; sub?: string }[];
  format?: FormatKey;
  color?: string;
  empty?: string;
}) {
  const format = FORMATS[fmtKey];
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              {r.swatch && <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: r.swatch }} />}
              <span className="truncate">{r.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 font-normal text-slate-500">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
