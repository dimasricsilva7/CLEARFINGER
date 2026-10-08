"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductStack } from "@/components/ui/ProductStage";
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

function Summary({ order, imageUrl }: { order: PublicOrder; imageUrl: string | null }) {
  const main = order.items.find((i) => i.kind === "OFFER") ?? order.items[0];
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-line bg-gradient-to-b from-mist to-surface p-4">
        {imageUrl && main && <ProductStack src={imageUrl} alt="" count={main.units * main.quantity} className="h-20 w-24 shrink-0" />}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Resumo do pedido</p>
          <p className="font-semibold text-navy">{main?.name}</p>
          <p className="text-sm text-muted">Pedido {order.orderNumber}</p>
        </div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        {order.items.map((i, idx) => (
          <div key={idx} className="flex justify-between gap-3">
            <span className="text-muted">{i.kind === "ORDER_BUMP" ? "+ " : ""}{i.quantity > 1 ? `${i.quantity}× ` : ""}{i.offerName}</span>
            <span className="shrink-0 tabular-nums text-ink">{formatBRL(i.totalPriceCents)}</span>
          </div>
        ))}
        <div className="flex justify-between"><span className="text-muted">Frete</span><span className={order.shippingCents ? "" : "font-semibold text-success"}>{order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"}</span></div>
        <div className="flex items-baseline justify-between border-t border-line pt-2.5"><span className="font-semibold text-navy">Total</span><span className="font-display text-xl font-semibold tabular-nums text-navy">{formatBRL(order.totalCents)}</span></div>
        {order.crediario && <div className="flex justify-between text-navy"><span>{order.crediario.methodLabel}</span><span className="font-semibold">{order.crediario.installmentLabel}</span></div>}
      </div>
    </section>
  );
}

function NextSteps({ paid }: { paid: boolean }) {
  const steps = [
    { icon: "check", title: "Pagamento confirmado", text: "A confirmação é automática — você não precisa enviar comprovante." },
    { icon: "box", title: "Preparamos o seu pedido", text: "Separamos e embalamos o seu CLEARFINGER." },
    { icon: "truck", title: "Envio", text: "Você recebe as atualizações da entrega pelo contato informado." },
  ];
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-navy">O que acontece agora</h2>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-3">
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-12px)] w-px bg-line" />}
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${paid && i === 0 ? "bg-success text-white" : "bg-mist text-primary"}`}>
              <Icon name={s.icon} className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-navy">{s.title}</p>
              <p className="text-[13px] leading-snug text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type CrediarioTexts = { successTitle: string; successMessage: string; infoMessage: string };

export function OrderClient({ initial, token, qrSvg, whatsappUrl, storeName, crediarioTexts, imageUrl }: { initial: PublicOrder; token: string; qrSvg: string | null; whatsappUrl: string | null; storeName: string; crediarioTexts: CrediarioTexts; imageUrl: string | null }) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const isPix = order.paymentMethod === "PIX";
  const awaiting = isPix && isAwaitingPix(order.status);
  const paid = isPaidStatus(order.status);
  const left = useCountdown(awaiting ? order.pixExpiresAt : null);

  useEffect(() => setOrder(initial), [initial]);
  // No computador o QR Code aparece aberto; no celular o "copia e cola" é o principal
  useEffect(() => setShowQr(window.matchMedia("(min-width: 768px)").matches), []);

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
    setTimeout(() => setCopied(false), 3000);
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
  const totalWindow = order.pixExpiresAt ? Math.max(60_000, new Date(order.pixExpiresAt).getTime() - new Date(order.createdAt).getTime()) : null;
  const pctLeft = left != null && totalWindow ? Math.max(0, Math.min(100, (left / totalWindow) * 100)) : null;
  const statusLabel = ORDER_STATUS_LABEL[order.status as keyof typeof ORDER_STATUS_LABEL] ?? order.status;
  const credPending = order.status === "CREDIARIO_PENDENTE" || order.status === "CREDIARIO_EM_ANALISE";

  return (
    <div className="container-page max-w-xl space-y-4 pb-16 pt-5 sm:pt-10">
      {/* Cabeçalho */}
      <div className="text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${paid ? "bg-success text-white" : awaiting || credPending ? "bg-primary/10 text-primary" : "bg-mist text-navy"}`}>
          <Icon name={paid ? "check" : awaiting ? "pix" : credPending ? "clock" : "box"} className="h-7 w-7" strokeWidth={2} />
        </span>
        {awaiting && (
          <>
            <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight text-navy sm:text-4xl">Pedido reservado, {order.customerFirstName}!</h1>
            <p className="mt-1 text-muted">Falta só o pagamento via PIX para confirmar.</p>
          </>
        )}
        {isPix && paid && (
          <>
            <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight text-navy sm:text-4xl">Pagamento confirmado!</h1>
            <p className="mt-1 text-muted">Obrigado, {order.customerFirstName}. Recebemos {formatBRL(order.totalCents)}.</p>
          </>
        )}
        {canRenew && <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight text-navy">O código PIX expirou</h1>}
        {!isPix && <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight text-navy sm:text-4xl">{credPending ? crediarioTexts.successTitle : statusLabel}</h1>}
        {isPix && !awaiting && !paid && !canRenew && <h1 className="mt-3 font-display text-[1.75rem] font-semibold text-navy">{statusLabel}</h1>}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">Pedido {order.orderNumber}</p>
      </div>

      {/* PIX */}
      {awaiting && order.pixCopyPaste && !expiredNow && (
        <section className="overflow-hidden rounded-[1.5rem] bg-surface shadow-lift ring-1 ring-line" aria-labelledby="pix-title">
          <div className="relative overflow-hidden bg-navy px-5 py-5 text-center text-white">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(var(--c-primary)/0.55),transparent_70%)]" />
            <p id="pix-title" className="relative text-[13px] font-semibold uppercase tracking-[0.14em] text-sky-200">Valor a pagar</p>
            <p className="relative font-display text-[2.5rem] font-semibold leading-tight tabular-nums">{formatBRL(order.totalCents)}</p>
            {left != null && (
              <div className="relative mx-auto mt-2 max-w-xs" aria-live="polite">
                <p className={`text-sm font-semibold ${left < 5 * 60000 ? "text-amber-300" : "text-white/80"}`}>Código válido por {mm}:{String(ss).padStart(2, "0")}</p>
                {pctLeft != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className={`h-full rounded-full transition-[width] duration-1000 ${left < 5 * 60000 ? "bg-amber-300" : "bg-sky-300"}`} style={{ width: `${pctLeft}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-5">
            <button onClick={copy} data-cta="pix_copy" className={`btn w-full text-base ${copied ? "bg-success text-white" : "btn-primary"}`}>
              <Icon name={copied ? "check" : "pix"} className="h-5 w-5" strokeWidth={2} />
              {copied ? "Código copiado! Agora pague no app do banco" : "Copiar código PIX"}
            </button>
            <label htmlFor="pix-code" className="sr-only">Código PIX copia e cola</label>
            <textarea id="pix-code" readOnly value={order.pixCopyPaste} rows={2} className="mt-3 w-full resize-none rounded-xl border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-muted" onFocus={(e) => e.currentTarget.select()} />

            <ol className="mt-4 grid gap-2">
              {[
                "Copie o código acima",
                "Abra o app do seu banco e escolha PIX copia e cola",
                "Cole, confira o valor e confirme — a aprovação aqui é automática",
              ].map((t, i) => (
                <li key={t} className="flex items-center gap-3 rounded-xl bg-mist/60 px-3 py-2.5 text-[14px] text-navy">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface font-display text-[13px] font-semibold text-primary ring-1 ring-line">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>

            {qrSvg && (
              <div className="mt-4">
                <button type="button" onClick={() => setShowQr((v) => !v)} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-primary" aria-expanded={showQr}>
                  {showQr ? "Ocultar QR Code" : "Prefere escanear? Mostrar QR Code"}
                </button>
                {showQr && (
                  <div className="mx-auto mt-2 w-60 rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-line">
                    <div className="[&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR Code do PIX" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    <p className="mt-2 text-center text-xs text-muted">Escaneie com o app do banco</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success/[0.07] py-2.5 text-sm font-medium text-success" aria-live="polite">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" /></span>
              Aguardando o pagamento — esta página atualiza sozinha
            </div>
            <button onClick={checkNow} disabled={checking} className="btn-ghost mt-1 w-full">{checking ? "Verificando…" : "Já paguei — verificar agora"}</button>
          </div>
          <p className="flex items-center justify-center gap-1.5 border-t border-line bg-bg px-4 py-3 text-xs text-muted">
            <Icon name="lock" className="h-3.5 w-3.5" /> Pagamento processado com segurança · seus dados bancários não passam por nós
          </p>
        </section>
      )}

      {awaiting && !order.pixCopyPaste && (
        <section className="card p-6 text-center">
          <p className="font-semibold text-navy">{order.pixError ? "Não conseguimos gerar o PIX agora." : "Gerando seu PIX…"}</p>
          <button onClick={retryPix} disabled={retrying} className="btn-primary mt-4">{retrying ? "Tentando…" : "Tentar novamente"}</button>
        </section>
      )}

      {/* PIX vencido → novo código no mesmo pedido */}
      {(canRenew || expiredNow) && (
        <section className="card overflow-hidden text-center">
          <div className="bg-mist/70 px-5 py-5">
            <p className="font-display text-3xl font-semibold tabular-nums text-navy">{formatBRL(order.totalCents)}</p>
            <p className="mt-1 text-sm text-muted">Gere um novo código em 1 toque — mesmo pedido, mesmo valor.</p>
          </div>
          <div className="p-5">
            <button onClick={renewPix} disabled={renewing} data-cta="pix_renew" className="btn-primary w-full">{renewing ? "Gerando novo PIX…" : "Gerar novo código PIX"}</button>
            {renewError && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{renewError}</p>}
            <p className="mt-3 text-xs text-muted">Se você já pagou o código anterior, não pague de novo: fale com a gente.</p>
          </div>
        </section>
      )}

      {/* CREDIÁRIO */}
      {!isPix && (
        <section className="card p-5 text-center sm:p-6">
          <p className="inline-block rounded-full bg-mist px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">{statusLabel}</p>
          {credPending && (
            <>
              {crediarioTexts.successMessage && <p className="mt-3 text-muted">{crediarioTexts.successMessage}</p>}
              {crediarioTexts.infoMessage && <p className="mt-3 rounded-xl bg-mist/70 px-4 py-3 text-sm text-navy">{crediarioTexts.infoMessage}</p>}
            </>
          )}
          {paid && <p className="mt-3 text-muted">Seu pedido foi aprovado. Agora vamos preparar o envio.</p>}
          {order.status === "CREDIARIO_RECUSADO" && <p className="mt-3 text-muted">Não foi possível aprovar este pedido no crediário. Fale com a gente para concluir a compra de outra forma.</p>}
        </section>
      )}

      {paid && order.fulfillmentStatus !== "PENDING" && (
        <p className="text-center text-sm font-semibold text-primary">
          {FULFILLMENT_LABEL[order.fulfillmentStatus as keyof typeof FULFILLMENT_LABEL]}
          {order.trackingCode && <> · rastreio <b>{order.trackingCode}</b></>}
        </p>
      )}

      <Summary order={order} imageUrl={imageUrl} />
      {(awaiting || paid) && <NextSteps paid={paid} />}

      <div className="flex flex-col items-center gap-2 pt-2 text-sm">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-light w-full">
            <Icon name="chat" className="h-5 w-5 text-primary" /> Dúvidas? Fale com a {storeName}
          </a>
        )}
        <Link href="/" className="btn-ghost">Voltar ao início</Link>
      </div>
    </div>
  );
}
