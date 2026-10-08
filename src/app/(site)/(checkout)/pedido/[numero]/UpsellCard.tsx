"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/client/tracking";
import { formatBRL } from "@/utils/format";
import type { PublicUpsell } from "@/types/order";

/** Oferta pós-compra: aceitar gera um novo pedido PIX; recusar só esconde. O pedido atual nunca é alterado. */
export function UpsellCard({ upsell, orderNumber, token }: { upsell: PublicUpsell; orderNumber: string; token: string }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = (action: "view" | "accept" | "decline") =>
    fetch("/api/orders/upsell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido: orderNumber, t: token, upsellId: upsell.id, action }) });

  useEffect(() => {
    track("upsell_view", { valueCents: upsell.priceCents, props: { upsell: upsell.id } });
    send("view").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upsell.id]);

  if (hidden) return null;

  async function accept() {
    setBusy(true);
    setError(null);
    track("upsell_accept", { valueCents: upsell.priceCents, props: { upsell: upsell.id } });
    try {
      const res = await send("accept");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.orderNumber) throw new Error(data.error ?? "Não foi possível adicionar agora.");
      router.push(`/pedido/${encodeURIComponent(data.orderNumber)}?t=${encodeURIComponent(data.t)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível adicionar agora.");
      setBusy(false);
    }
  }

  function decline() {
    track("upsell_decline", { props: { upsell: upsell.id } });
    send("decline").catch(() => {});
    setHidden(true);
  }

  const off = upsell.compareAtPriceCents && upsell.compareAtPriceCents > upsell.priceCents ? upsell.compareAtPriceCents : null;
  return (
    <section className="overflow-hidden rounded-[1.5rem] bg-surface shadow-lift ring-2 ring-primary/30" aria-labelledby="upsell-title" data-testid="upsell">
      <p className="bg-primary px-4 py-2 text-center text-[12px] font-bold uppercase tracking-[0.14em] text-white">{upsell.badge || "Oferta exclusiva para o seu pedido"}</p>
      <div className="flex gap-4 p-5">
        {upsell.imageUrl && (
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
            <img src={upsell.imageUrl} alt={upsell.productName} className="h-full w-full object-contain" loading="lazy" />
          </div>
        )}
        <div className="min-w-0">
          <h2 id="upsell-title" className="font-display text-lg font-semibold leading-snug text-navy">{upsell.title}</h2>
          {upsell.description && <p className="mt-1 text-sm leading-relaxed text-muted">{upsell.description}</p>}
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            {off && <span className="text-sm text-muted line-through">{formatBRL(off)}</span>}
            <span className="font-display text-2xl font-semibold tabular-nums text-navy">{formatBRL(upsell.priceCents)}</span>
            {upsell.quantity > 1 && <span className="text-xs font-semibold text-muted">({upsell.quantity} un.)</span>}
          </p>
        </div>
      </div>
      <div className="space-y-2 px-5 pb-5">
        <button onClick={accept} disabled={busy} data-cta="upsell_accept" className="btn-primary w-full">{busy ? "Gerando PIX…" : upsell.acceptLabel}</button>
        <button onClick={decline} disabled={busy} data-cta="upsell_decline" className="btn-ghost w-full text-muted">{upsell.declineLabel}</button>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-center text-xs text-muted">Pagamento separado via PIX. Seu pedido atual já está garantido e não muda.</p>
      </div>
    </section>
  );
}
