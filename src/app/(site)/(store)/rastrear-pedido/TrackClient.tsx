"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/client/tracking";
import { formatBRL, formatDate } from "@/utils/format";
import { TrackingTimeline } from "@/components/ui/TrackingTimeline";
import type { PublicTrackingResult } from "@/server/delivery";

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export function TrackClient({ initialOrder, support }: { initialOrder: string; support: { whatsapp: string | null; email: string | null } }) {
  const [mode, setMode] = useState<"cpf" | "email">("cpf");
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTrackingResult | null>(null);

  useEffect(() => track("tracking_page_view"), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (orderNumber.trim().length < 4) return setError("Informe o número do pedido.");
    if (mode === "cpf" && cpf.replace(/\D/g, "").length !== 11) return setError("Informe o CPF completo (11 dígitos).");
    if (mode === "email" && !/^\S+@\S+\.\S+$/.test(email)) return setError("Informe um e-mail válido.");
    setLoading(true);
    track("tracking_search_started", { props: { method: mode } }); // nunca envia número do pedido, CPF ou e-mail
    try {
      const res = await fetch("/api/rastrear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, ...(mode === "cpf" ? { cpf } : { email }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? "Não foi possível consultar agora. Tente novamente.");
        if (res.status === 404) track("tracking_order_not_found");
        return;
      }
      const r = data as PublicTrackingResult;
      setResult(r);
      track("tracking_order_found");
      track("tracking_status_viewed", { props: { delivered: r.delivered, paid: r.paid, steps: r.events.filter((x) => x.done).length } });
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-5 sm:p-6" noValidate>
        <div>
          <label htmlFor="orderNumber" className="label">Número do pedido</label>
          <input id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="Ex.: CF12345-2026" autoComplete="off" autoCapitalize="characters" className="input" />
        </div>
        <div role="radiogroup" aria-label="Confirmar com" className="grid grid-cols-2 gap-2 rounded-xl bg-mist p-1">
          {(["cpf", "email"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-[44px] rounded-lg text-sm font-bold transition ${mode === m ? "bg-surface text-navy shadow-sm" : "text-muted"}`}>
              {m === "cpf" ? "CPF" : "E-mail"}
            </button>
          ))}
        </div>
        {mode === "cpf" ? (
          <div>
            <label htmlFor="cpf" className="label">CPF usado na compra</label>
            <input id="cpf" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" className="input" />
          </div>
        ) : (
          <div>
            <label htmlFor="email" className="label">E-mail usado na compra</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} inputMode="email" placeholder="voce@email.com" autoComplete="email" className="input" />
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Consultando…" : "Rastrear pedido"}</button>
      </form>

      {result && (
        <div className="mt-6 space-y-4" aria-live="polite">
          <div className="card overflow-hidden">
            <div className="bg-navy px-5 py-4 text-white sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Pedido {result.orderNumber}</p>
              <p className="mt-1 font-display text-xl font-semibold">{result.statusLabel}</p>
              {result.paid && !result.delivered && <p className="mt-1 text-sm text-white/75">{result.etaText}</p>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm sm:px-6">
              <div className="col-span-2">
                <dt className="text-muted">Produto</dt>
                <dd className="font-semibold text-navy">{result.items.map((i) => `${i.name} (${i.quantity} un.)`).join(" + ")}</dd>
              </div>
              <div>
                <dt className="text-muted">Data do pedido</dt>
                <dd className="font-semibold text-navy">{formatDate(result.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">Valor</dt>
                <dd className="font-semibold text-navy">{formatBRL(result.totalCents)}</dd>
              </div>
              <div>
                <dt className="text-muted">Pagamento</dt>
                <dd className="font-semibold text-navy">{result.paymentMethod}</dd>
              </div>
              <div>
                <dt className="text-muted">Quantidade</dt>
                <dd className="font-semibold text-navy">{result.items.reduce((a, i) => a + i.quantity, 0)} un.</dd>
              </div>
            </dl>
          </div>
          <div className="card p-5 sm:p-6">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.12em] text-navy">Linha do tempo</p>
            {result.events.length ? <TrackingTimeline events={result.events} /> : <p className="text-sm text-muted">Assim que o pagamento for confirmado, as etapas da entrega aparecem aqui.</p>}
          </div>
        </div>
      )}

      {(support.whatsapp || support.email) && (
        <p className="mt-6 text-center text-sm text-muted">
          Precisa de ajuda?{" "}
          {support.whatsapp && <a href={support.whatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Fale no WhatsApp</a>}
          {support.whatsapp && support.email && " ou "}
          {support.email && <a href={`mailto:${support.email}`} className="font-semibold text-primary hover:underline">{support.email}</a>}
        </p>
      )}
    </>
  );
}
