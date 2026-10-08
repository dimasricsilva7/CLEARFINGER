"use client";

import { useEffect, useRef, useState } from "react";
import { gaEvent, metaEvent, track, trackOnce } from "@/lib/client/tracking";

/** Dispara um evento uma única vez quando o elemento aparece na tela (product_view, offer_view…). */
export function ViewTracker({
  id,
  event,
  productId,
  offerId,
  valueCents,
  meta,
  children,
  className,
}: {
  id: string;
  event: "product_view" | "offer_view" | "landing_view";
  productId?: string | null;
  offerId?: string | null;
  valueCents?: number | null;
  meta?: { name: string; params: Record<string, unknown> } | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (meta) {
          metaEvent(meta.name, meta.params, { mirror: true, internal: { name: event, productId, offerId, valueCents } });
          if (meta.name === "ViewContent") gaEvent("view_item", { currency: "BRL", value: (valueCents ?? 0) / 100 });
        } else trackOnce(`${event}:${id}`, event, { productId, offerId, valueCents });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, event, productId, offerId, valueCents, meta]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Profundidade de rolagem (50% e 90%) — uma vez por página. */
export function ScrollDepth() {
  useEffect(() => {
    const fired = new Set<number>();
    const on = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop + innerHeight) / h.scrollHeight;
      for (const p of [50, 90]) {
        if (pct * 100 >= p && !fired.has(p)) {
          fired.add(p);
          track(p === 50 ? "scroll_50" : "scroll_90");
        }
      }
    };
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return null;
}

/** Link para o checkout com a oferta escolhida (registra offer_selected antes de navegar). */
export function OfferLink({ href, offerId, productId, valueCents, className, children, cta }: { href: string; offerId: string; productId: string; valueCents: number; className?: string; children: React.ReactNode; cta: string }) {
  return (
    <a
      href={href}
      data-cta={cta}
      className={className}
      onClick={() => {
        track("offer_selected", { productId, offerId, valueCents, element: cta });
      }}
    >
      {children}
    </a>
  );
}

export function FaqItem({ q, a, i }: { q: string; a: string; i: number }) {
  return (
    <details
      className="group rounded-xl border border-line bg-surface px-5 open:shadow-soft"
      onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && trackOnce(`faq:${i}`, "faq_open", { props: { q: q.slice(0, 80) } })}
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-navy [&::-webkit-details-marker]:hidden">
        {q}
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist text-primary transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="whitespace-pre-line pb-5 text-[15px] leading-relaxed text-muted">{a}</div>
    </details>
  );
}

const embedUrl = (url: string) => {
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&playsinline=1`;
  const vm = /vimeo\.com\/(\d+)/.exec(url);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
};

/** Vídeo vertical da demonstração (MP4 ou YouTube/Vimeo), com eventos de início e fim. */
export function DemoVideo({ url, poster, label }: { url: string; poster?: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const embed = embedUrl(url);
  if (failed) return null;
  if (embed)
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-card bg-navy shadow-lift">
        <iframe src={embed} title={label} className="absolute inset-0 h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  return (
    <video
      src={url}
      poster={poster || undefined}
      controls
      playsInline
      preload="metadata"
      className="mx-auto aspect-[9/16] w-full max-w-[320px] rounded-card bg-navy object-cover shadow-lift"
      onPlay={() => trackOnce("video_start", "video_start")}
      onEnded={() => trackOnce("video_complete", "video_complete")}
      onError={() => setFailed(true)}
      aria-label={label}
    />
  );
}
