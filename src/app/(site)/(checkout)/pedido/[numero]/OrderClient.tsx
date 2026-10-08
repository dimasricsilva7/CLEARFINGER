"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { gaEvent, metaEvent, track } from "@/lib/client/tracking";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, isAwaitingPix, isPaidStatus } from "@/lib/domain";
import { formatBRL } from "@/utils/format";
import type { PublicOrder } from "@/types/order";

function useCountdown(iso: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const end = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

function Items({ order }: { order: PublicOrder }) {
  return (
    <div className="space-y-2 text-sm">
      {order.items.map((i, idx) => (
        <div key={idx} className="flex justify-between gap-3">
          <span className="text-muted">{i.quantity > 1 ? `${i.quantity}× ` : ""}{i.name} — {i.offerName}</span>
          <span className="shrink-0 tabular-nums">{formatBRL(i.totalPriceCents)}</span>
        </div>
      ))}
      <div className="flex justify-between"><span className="text-muted">Frete</span><span>{order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"}</span></div>
      <div className="flex justify-between border-t border-line pt-2 font-bold text-navy"><span>Total</span><span className="tabular-nums">{formatBRL(order.totalCents)}</span></div>
      {order.crediario && <div className="flex justify-between text-navy"><span>{order.crediario.methodLabel}</span><span>{order.crediario.installmentLabel}</span></div>}
    </div>
  );
}

export type CrediarioTexts = { successTitle: string; successMessage: string; infoMessage: string };

export function OrderClient({ initial, token, qrSvg, whatsappUrl, storeName, crediarioTexts }: { initial: PublicOrder; token: string; qrSvg: string | null; whatsappUrl: string | null; storeName: string; crediarioTexts: CrediarioTexts }) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const isPix = order.paymentMethod === "PIX";
  const awaiting = isPix && isAwaitingPix(order.status);
  const paid = isPaidStatus(order.status);
  const left = useCountdown(awaiting ? order.pixExpiresAt : null);

  useEffect(() => setOrder(initial), [initial]);

  // Polling enquanto aguarda pagamento (o status vem SEMPRE do servidor/gateway)
  useEffect(() => {
    if (!awaiting) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/status?pedido=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (res.ok && !stop) {
          const next = (await res.json()) as PublicOrder;
          if (next.status !== order.status || next.pixCopyPaste !== order.pixCopyPaste) router.refresh();
          setOrder(next);
        }
      } catch {
        /* rede instável: tenta de novo */
      }
    };
    const t = setInterval(() => document.visibilityState === "visible" && poll(), 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [awaiting, order.orderNumber, order.status, order.pixCopyPaste, token, router]);

  // Purchase no navegador somente quando o servidor confirma (mesmo event_id da CAPI → deduplicação)
  useEffect(() => {
    if (!paid || !order.metaEventId) return;
    const key = `cf_purchase_${order.orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    const units = order.items.reduce((s, i) => s + i.quantity * i.units, 0);
    metaEvent("Purchase", { value: order.totalCents / 100, currency: "BRL", content_type: "product", num_items: units }, { eventId: order.metaEventId });
    gaEvent("purchase", { transaction_id: order.orderNumber, value: order.totalCents / 100, currency: "BRL", items: order.items.map((i) => ({ item_name: `${i.name} — ${i.offerName}`, price: i.unitPriceCents / 100, quantity: i.quantity })) });
  }, [paid, order.metaEventId, order.orderNumber, order.totalCents, order.items]);

  const copy = async () => {
    if (!order.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(order.pixCopyPaste);
    } catch {
      const ta = document.getElementById("pix-code") as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    track("pix_copied", { valueCents: order.totalCents, props: { order: order.orderNumber } });
    setTimeout(() => setCopied(false), 2500);
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/orders/status?pedido=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(token)}&force=1`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as PublicOrder;
        setOrder(next);
        if (next.status !== order.status) router.refresh();
      }
    } finally {
      setTimeout(() => setChecking(false), 1200);
    }
  };

  const retryPix = async () => {
    setRetrying(true);
    try {
      await fetch(`/api/orders/status?pedido=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(token)}&retry=1`, { cache: "no-store" });
      router.refresh();
    } finally {
      setTimeout(() => setRetrying(false), 1500);
    }
  };

  const renewPix = async () => {
    setRenewing(true);
    setRenewError(null);
    try {
      const res = await fetch("/api/orders/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido: order.orderNumber, t: token }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível gerar um novo PIX.");
      setOrder(json as PublicOrder);
      track("pix_renewed", { valueCents: order.totalCents, props: { order: order.orderNumber } });
      router.refresh();
    } catch (e) {
      setRenewError(e instanceof Error ? e.message : "Não foi possível gerar um novo PIX.");
    } finally {
      setRenewing(false);
    }
  };
  const canRenew = isPix && (order.status === "EXPIRED" || order.status === "FAILED");
  const expiredNow = awaiting && left === 0;
  const mm = left != null ? Math.floor(left / 60000) : null;
  const ss = left != null ? Math.floor((left % 60000) / 1000) : null;
  const statusLabel = ORDER_STATUS_LABEL[order.status as keyof typeof ORDER_STATUS_LABEL] ?? order.status;

  return (
    <div className="container-page max-w-2xl space-y-5 py-6 sm:py-10">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted">Pedido {order.orderNumber}</p>
        {awaiting && <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">Falta pouco, {order.customerFirstName}!</h1>}
        {isPix && paid && <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">Pagamento confirmado</h1>}
        {canRenew && <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">O PIX anterior expirou</h1>}
        {!isPix && <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">{order.status === "CREDIARIO_PENDENTE" || order.status === "CREDIARIO_EM_ANALISE" ? crediarioTexts.successTitle : statusLabel}</h1>}
        {isPix && !awaiting && !paid && !canRenew && <h1 className="mt-1 font-display text-3xl font-bold text-navy">{statusLabel}</h1>}
      </div>

      {/* CREDIÁRIO */}
      {!isPix && (
        <section className="card p-5 text-center sm:p-6">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon name={paid ? "check" : "clock"} className="h-7 w-7" strokeWidth={2} />
          </span>
          <p className="mt-3 inline-block rounded-full bg-mist px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">{statusLabel}</p>
          {(order.status === "CREDIARIO_PENDENTE" || order.status === "CREDIARIO_EM_ANALISE") && (
            <>
              {crediarioTexts.successMessage && <p className="mt-3 text-muted">{crediarioTexts.successMessage}</p>}
              {crediarioTexts.infoMessage && <p className="mt-3 rounded-xl bg-mist/70 px-4 py-3 text-sm text-navy">{crediarioTexts.infoMessage}</p>}
            </>
          )}
          {paid && <p className="mt-3 text-muted">Seu pedido foi aprovado. Agora vamos preparar o envio.</p>}
          {order.status === "CREDIARIO_RECUSADO" && <p className="mt-3 text-muted">Não foi possível aprovar este pedido no crediário. Fale com a gente para concluir a compra de outra forma.</p>}
        </section>
      )}

      {/* PIX vencido → novo código no mesmo pedido */}
      {(canRenew || expiredNow) && (
        <section className="card overflow-hidden text-center">
          <div className="bg-mist/70 px-5 py-4">
            <p className="font-display text-3xl font-bold tabular-nums text-navy">{formatBRL(order.totalCents)}</p>
            <p className="mt-1 text-sm text-muted">Gere um novo código — mesmo pedido, mesmo valor.</p>
          </div>
          <div className="p-5">
            <button onClick={renewPix} disabled={renewing} data-cta="pix_renew" className="btn-primary w-full">{renewing ? "Gerando novo PIX…" : "Gerar novo PIX"}</button>
            {renewError && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{renewError}</p>}
            <p className="mt-3 text-xs text-muted">Se você já pagou o código anterior, não pague de novo: fale com a gente.</p>
          </div>
        </section>
      )}

      {/* PIX */}
      {awaiting && order.pixCopyPaste && !expiredNow && (
        <section className="card overflow-hidden" aria-labelledby="pix-title">
          <div className="bg-mist/70 px-5 py-4 text-center">
            <p id="pix-title" className="font-semibold text-navy">Pague com PIX para concluir</p>
            <p className="font-display text-3xl font-bold tabular-nums text-navy">{formatBRL(order.totalCents)}</p>
            {left != null && (
              <p className={`mt-1 text-sm font-semibold ${left < 5 * 60000 ? "text-danger" : "text-muted"}`} aria-live="polite">
                {left > 0 ? `O código expira em ${mm}:${String(ss).padStart(2, "0")}` : "O prazo deste PIX terminou."}
              </p>
            )}
          </div>
          <div className="p-5">
            <ol className="mb-4 space-y-1 text-sm text-muted">
              <li>1. Copie o código abaixo (ou escaneie o QR Code)</li>
              <li>2. No app do seu banco, escolha <b>PIX copia e cola</b></li>
              <li>3. Confirme o pagamento — a confirmação aqui é automática</li>
            </ol>
            <button onClick={copy} data-cta="pix_copy" className={`btn w-full ${copied ? "bg-success text-white" : "btn-primary"}`}>{copied ? "Código copiado" : "Copiar código PIX"}</button>
            <label htmlFor="pix-code" className="sr-only">Código PIX copia e cola</label>
            <textarea id="pix-code" readOnly value={order.pixCopyPaste} rows={3} className="mt-3 w-full resize-none rounded-xl border border-line bg-bg p-3 font-mono text-xs text-muted" onFocus={(e) => e.currentTarget.select()} />
            {qrSvg && (
              <details className="mt-3 text-center" open>
                <summary className="cursor-pointer text-sm font-bold text-primary">QR Code</summary>
                <div className="mx-auto mt-3 w-56 rounded-xl border border-line bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR Code do PIX" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </details>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted" aria-live="polite">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" /></span>
              Aguardando pagamento…
            </div>
            <button onClick={checkNow} disabled={checking} className="btn-ghost mt-1 w-full">{checking ? "Verificando…" : "Já paguei — verificar agora"}</button>
          </div>
        </section>
      )}

      {awaiting && !order.pixCopyPaste && (
        <section className="card p-6 text-center">
          <p className="font-bold">{order.pixError ? "Não conseguimos gerar o PIX agora." : "Gerando seu PIX…"}</p>
          <button onClick={retryPix} disabled={retrying} className="btn-primary mt-4">{retrying ? "Tentando…" : "Tentar novamente"}</button>
        </section>
      )}

      {isPix && paid && (
        <section className="card p-5 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success"><Icon name="check" className="h-7 w-7" strokeWidth={2.2} /></span>
          <p className="mt-3 text-muted">Recebemos o pagamento de <b className="text-navy">{formatBRL(order.totalCents)}</b>. Agora vamos preparar o seu pedido.</p>
        </section>
      )}

      {paid && order.fulfillmentStatus !== "PENDING" && (
        <p className="text-center text-sm font-semibold text-primary">
          {FULFILLMENT_LABEL[order.fulfillmentStatus as keyof typeof FULFILLMENT_LABEL]}
          {order.trackingCode && <> · rastreio <b>{order.trackingCode}</b></>}
        </p>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-bold">Resumo</h2>
        <div className="mt-3"><Items order={order} /></div>
      </section>

      <div className="flex flex-col items-center gap-2 text-sm">
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-light w-full sm:w-auto">Falar com a {storeName} no WhatsApp</a>}
        <Link href="/" className="btn-ghost">Voltar ao início</Link>
      </div>
    </div>
  );
}
