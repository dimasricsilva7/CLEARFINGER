/* eslint-disable @next/next/no-img-element */
import type { Faq, Testimonial } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";
import { ProductStack, Stage } from "@/components/ui/ProductStage";
import { cfgArr, cfgStr, type SectionData } from "@/server/landing";
import { offerDiscountLabel } from "@/lib/pricing";
import { formatBRL } from "@/utils/format";
import type { IconItem } from "@/lib/domain";
import type { PublicProduct } from "@/types/catalog";
import { DemoVideo, FaqItem, OfferLink, ViewTracker } from "./client";

export type Tone = "white" | "mist" | "navy";

export type LandingCtx = {
  product: PublicProduct | null;
  faqs: Faq[];
  testimonials: Testimonial[];
  /** "ou 2x de R$ 29,95 no crediário" para um valor (null se o crediário estiver desligado) */
  crediarioHint: (cents: number) => string | null;
  pixLabel: string | null;
  /** Frete grátis + prazo (null com frete grátis desligado) */
  shipping: { label: string; eta: string } | null;
};

/** Faixa "FRETE GRÁTIS PARA TODO O BRASIL · ENTREGA DE 3 A 5 DIAS ÚTEIS". */
function ShippingStrip({ ctx, tone, className = "" }: { ctx: LandingCtx; tone: Tone; className?: string }) {
  if (!ctx.shipping) return null;
  const d = dark(tone);
  return (
    <p data-testid="shipping-strip" className={`inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[11.5px] font-bold uppercase leading-tight tracking-[0.06em] sm:text-xs ${d ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-success/[0.08] text-navy ring-1 ring-success/25"} ${className}`}>
      <Icon name="truck" className={`h-4 w-4 shrink-0 ${d ? "text-white" : "text-success"}`} />
      <span>
        {ctx.shipping.label}
        {ctx.shipping.eta && <span className={`block font-semibold sm:inline ${d ? "text-white/70" : "text-muted"}`}><span className="hidden sm:inline"> · </span>Entrega de {ctx.shipping.eta}</span>}
      </span>
    </p>
  );
}

type P = { s: SectionData; ctx: LandingCtx; tone: Tone };

const paragraphs = (body: string | null) => (body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const BG: Record<Tone, string> = {
  white: "bg-surface",
  mist: "bg-mist/70",
  navy: "bg-navy text-white",
};
const dark = (t: Tone) => t === "navy";

function Heading({ s, tone, center = false, eyebrow }: { s: SectionData; tone: Tone; center?: boolean; eyebrow?: string }) {
  const eb = cfgStr(s.config, "eyebrow") || eyebrow;
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eb && <p className={`eyebrow ${dark(tone) ? "!text-sky-300" : ""}`}>{eb}</p>}
      {s.title && <h2 className={`h-section ${eb ? "mt-3" : ""} ${dark(tone) ? "!text-white" : ""}`}>{s.title}</h2>}
      {s.subtitle && <p className={`lead mt-4 ${dark(tone) ? "!text-white/70" : ""}`}>{s.subtitle}</p>}
    </div>
  );
}

const productImg = (ctx: LandingCtx) => ctx.product?.mainImage?.url ?? null;
const productAlt = (ctx: LandingCtx) => ctx.product?.mainImage?.alt ?? ctx.product?.name ?? "CLEARFINGER";

// ───────────── Primeira tela ─────────────

function Hero({ s, ctx, tone }: P) {
  const p = ctx.product;
  const offers = p?.offers ?? [];
  const entry = offers.length ? offers.reduce((a, b) => (b.priceCents < a.priceCents ? b : a)) : null;
  const img = s.imageUrl || productImg(ctx);
  const badges = cfgArr<string>(s.config, "badges").filter(Boolean).slice(0, 4);
  const hint = entry ? ctx.crediarioHint(entry.priceCents) : null;
  const eyebrow = cfgStr(s.config, "eyebrow");
  const meta = p ? { name: "ViewContent", params: { content_ids: [p.sku], content_name: p.name, content_type: "product", value: (entry?.priceCents ?? p.priceCents) / 100, currency: "BRL" } } : null;
  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_10%,rgb(var(--c-primary)/0.10),transparent_70%),linear-gradient(180deg,#fff_0%,rgb(var(--c-mist)/0.6)_100%)]" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-2 pb-10 pt-4 sm:pt-10 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pb-20 lg:pt-16">
        <div className="order-2 md:order-1">
          {eyebrow && (
            <p className="hidden items-center gap-2 rounded-full border border-primary/15 bg-surface/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[2rem] font-semibold leading-[1.07] tracking-[-0.02em] text-navy sm:text-5xl md:mt-5 lg:text-[3.5rem]">{s.title}</h1>
          {s.subtitle && <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{s.subtitle}</p>}

          {entry && (
            <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl border border-line bg-surface/90 p-4 shadow-soft md:max-w-md">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{offers.length > 1 ? "A partir de" : "Por"}</p>
                <p className="font-display text-[2rem] font-semibold leading-none tracking-tight text-navy">{formatBRL(entry.priceCents)}</p>
                {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
              </div>
              {ctx.pixLabel && <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">{ctx.pixLabel} na hora</span>}
            </div>
          )}

          <a id="hero-cta" href={s.ctaTarget || "#ofertas"} data-cta="hero_cta" className="btn-primary mt-4 w-full md:w-auto md:px-10">
            {s.ctaLabel || "Comprar"}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
          <div className="mt-3 flex justify-center md:justify-start"><ShippingStrip ctx={ctx} tone={tone} /></div>
          {badges.length > 0 && (
            <ul className="mt-5 grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-x-6">
              {badges.map((b, i) => (
                <li key={b} className="flex flex-col items-center gap-1 rounded-xl bg-surface/80 px-1 py-2.5 text-center text-[11px] font-semibold leading-tight text-navy/80 ring-1 ring-line md:flex-row md:bg-transparent md:p-0 md:text-[13px] md:ring-0">
                  <Icon name={["lock", "pix", "shield", "truck"][i] ?? "check"} className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {img && (
          <ViewTracker id="hero-product" event="product_view" productId={p?.id} valueCents={entry?.priceCents} meta={meta} className="order-1 md:order-2">
            {eyebrow && <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-primary md:hidden">{eyebrow}</p>}
            <Stage className="mx-auto aspect-[1/0.9] w-full max-w-[21rem] md:max-w-[34rem]">
              <ProductStack src={img} alt={productAlt(ctx)} className="absolute inset-x-0 bottom-[6%] top-[4%]" priority />
            </Stage>
          </ViewTracker>
        )}
      </div>
    </section>
  );
}

// ───────────── Dor / identificação ─────────────

function Pain({ s, tone }: P) {
  const items = cfgArr<string>(s.config, "items").filter(Boolean);
  const d = dark(tone);
  return (
    <section className={`relative overflow-hidden ${BG[tone]}`}>
      {s.imageUrl && (
        <div className="relative md:absolute md:inset-y-0 md:left-0 md:w-[46%]">
          <img src={s.imageUrl} alt="" className="h-64 w-full object-cover sm:h-80 md:h-full" loading="lazy" />
          <div aria-hidden="true" className={`absolute inset-0 ${d ? "bg-gradient-to-t from-navy via-navy/25 to-transparent md:bg-gradient-to-l md:from-navy md:via-navy/10" : "bg-gradient-to-t from-surface via-surface/20 to-transparent md:bg-gradient-to-l md:from-surface"}`} />
        </div>
      )}
      <div className={`container-page relative grid ${s.imageUrl ? "md:grid-cols-[46%_1fr]" : ""}`}>
        {s.imageUrl && <div className="hidden md:block" />}
        <div className={s.imageUrl ? "-mt-14 pb-14 md:mt-0 md:py-24 md:pl-14" : "section"}>
          <h2 className={`h-section ${d ? "!text-white" : ""}`}>{s.title}</h2>
          {s.subtitle && <p className={`lead mt-3 ${d ? "!text-white/70" : ""}`}>{s.subtitle}</p>}
          <div className="mt-5 space-y-4">
            {paragraphs(s.body).map((p, i) => (
              <p key={i} className={`text-[1.0625rem] leading-relaxed ${i === 0 ? (d ? "font-medium text-white" : "font-medium text-navy") : d ? "text-white/70" : "text-muted"}`}>
                {p}
              </p>
            ))}
          </div>
          {items.length > 0 && (
            <ul className="mt-7 space-y-2.5">
              {items.map((it) => (
                <li key={it} className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[15px] ${d ? "bg-white/[0.06] text-white/90 ring-1 ring-white/10" : "bg-mist/60 text-navy"}`}>
                  <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${d ? "bg-amber-300" : "bg-amber-500"}`} aria-hidden="true" />
                  {it}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── Solução ─────────────

function Solution({ s, ctx, tone }: P) {
  const points = cfgArr<string>(s.config, "points").filter(Boolean);
  const img = s.imageUrl || ctx.product?.secondaryImage?.url || productImg(ctx);
  const d = dark(tone);
  return (
    <section className={`section ${BG[tone]}`}>
      <div className="container-page grid items-center gap-8 md:grid-cols-2 md:gap-16">
        {img && (
          <Stage className="mx-auto aspect-square w-full max-w-[22rem] md:max-w-[30rem]">
            <ProductStack src={img} alt={productAlt(ctx)} className="absolute inset-x-0 bottom-[8%] top-[6%]" />
          </Stage>
        )}
        <div className="md:order-first">
          <p className={`eyebrow ${d ? "!text-sky-300" : ""}`}>{cfgStr(s.config, "eyebrow") || "A solução"}</p>
          <h2 className={`h-section mt-3 ${d ? "!text-white" : ""}`}>{s.title}</h2>
          {paragraphs(s.body).map((p, i) => (
            <p key={i} className={`lead mt-4 ${d ? "!text-white/70" : ""}`}>{p}</p>
          ))}
          {points.length > 0 && (
            <ul className="mt-6 grid grid-cols-2 gap-2.5">
              {points.map((pt) => (
                <li key={pt} className={`flex items-start gap-2 rounded-xl p-3 text-[14px] font-semibold leading-snug ${d ? "bg-white/[0.06] text-white" : "bg-mist/70 text-navy"}`}>
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-white">
                    <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
          )}
          {s.ctaLabel && (
            <a href={s.ctaTarget || "#ofertas"} data-cta="solution_cta" className={`${d ? "btn-primary" : "btn-navy"} mt-6 w-full sm:w-auto`}>
              {s.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── Como funciona ─────────────

function HowItWorks({ s, tone }: P) {
  const steps = cfgArr<{ title: string; text?: string; imageUrl?: string }>(s.config, "steps").filter((x) => x?.title);
  const note = cfgStr(s.config, "note");
  const d = dark(tone);
  const video = s.videoUrl || null;
  const withImages = steps.some((st) => st.imageUrl);
  return (
    <section id="como-funciona" className={`section ${BG[tone]}`}>
      <div className="container-page">
        <Heading s={s} tone={tone} eyebrow="Como usar" />
        <div className={`mt-10 grid items-start gap-6 ${video ? "lg:grid-cols-[300px_1fr] lg:gap-8" : ""}`}>
          {video && (
            <div className="mx-auto w-full max-w-[300px]">
              <DemoVideo url={video} poster={cfgStr(s.config, "posterUrl")} label={s.title ?? "Veja como funciona"} />
            </div>
          )}
          <ol className={`grid gap-4 md:gap-6 ${video ? "sm:grid-cols-3 lg:grid-cols-3" : "md:grid-cols-3"}`}>
            {steps.map((st, i) => (
              <li key={i} className={`relative overflow-hidden rounded-card ${withImages ? "grid grid-cols-[38%_1fr] sm:block" : ""} ${d ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-surface shadow-soft ring-1 ring-line"}`}>
                {withImages && (
                  <div className="relative min-h-[150px] bg-mist sm:aspect-[9/10] sm:min-h-0">
                    {st.imageUrl && <img src={st.imageUrl} alt={st.title} loading="lazy" decoding="async" width={900} height={1000} className="absolute inset-0 h-full w-full object-cover sm:static" />}
                    <span className="absolute left-2 top-2 sm:left-3 sm:top-3 rounded-full bg-white/95 px-2.5 py-1 font-display text-[10px] font-bold uppercase sm:px-3 sm:text-xs tracking-[0.12em] text-navy shadow-sm">Passo {i + 1}</span>
                  </div>
                )}
                <div className="relative self-center p-4 sm:p-6">
                  {!withImages && (
                    <>
                      <span aria-hidden="true" className={`absolute -right-1 -top-5 font-display text-[6.5rem] font-bold leading-none ${d ? "text-white/[0.06]" : "text-primary/[0.07]"}`}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-sm font-semibold text-white">{String(i + 1).padStart(2, "0")}</span>
                    </>
                  )}
                  <p className={`font-display text-base font-semibold uppercase tracking-[0.08em] sm:text-lg ${d ? "text-white" : "text-navy"}`}>{st.title}</p>
                  {st.text && <p className={`mt-1.5 text-sm leading-relaxed sm:mt-2 sm:text-[15px] ${d ? "text-white/70" : "text-muted"}`}>{st.text}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        {note && <p className={`mt-5 text-sm ${d ? "text-white/60" : "text-muted"}`}>{note}</p>}
      </div>
    </section>
  );
}

// ───────────── Demonstração ─────────────

export const hasDemo = (s: SectionData, ctx: Pick<LandingCtx, "product">) =>
  Boolean(s.videoUrl || ctx.product?.videoUrl || s.imageUrl || cfgStr(s.config, "beforeUrl") || cfgStr(s.config, "applicationUrl") || cfgStr(s.config, "afterUrl"));

function Demo({ s, ctx, tone }: P) {
  const video = s.videoUrl || ctx.product?.videoUrl || null;
  const steps = [
    { label: "Antes", url: cfgStr(s.config, "beforeUrl") },
    { label: "Aplicação", url: cfgStr(s.config, "applicationUrl") },
    { label: "Depois", url: cfgStr(s.config, "afterUrl") },
  ].filter((x) => x.url);
  if (!hasDemo(s, ctx)) return null; // sem material real, a seção não aparece
  const caption = cfgStr(s.config, "caption");
  return (
    <section className={`section ${BG[tone]}`}>
      <div className="container-page">
        <Heading s={s} tone={tone} center />
        <div className={`mt-10 grid items-start gap-8 ${video && (steps.length || s.imageUrl) ? "md:grid-cols-[320px_1fr]" : ""}`}>
          {video && <DemoVideo url={video} poster={cfgStr(s.config, "posterUrl")} label={s.title ?? "Demonstração"} />}
          {steps.length > 0 ? (
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {steps.map((st) => (
                <li key={st.label} className="overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line">
                  <img src={st.url} alt={st.label} className="aspect-square w-full object-cover" loading="lazy" />
                  <p className="px-4 py-3 text-sm font-bold uppercase tracking-wider text-navy">{st.label}</p>
                </li>
              ))}
            </ol>
          ) : (
            s.imageUrl && <img src={s.imageUrl} alt={s.title ?? ""} className="mx-auto w-full max-w-2xl rounded-card" loading="lazy" />
          )}
        </div>
        {caption && <p className={`mx-auto mt-6 max-w-2xl text-center text-sm ${dark(tone) ? "text-white/60" : "text-muted"}`}>{caption}</p>}
      </div>
    </section>
  );
}

// ───────────── Benefícios ─────────────

function Benefits({ s, tone }: P) {
  const items = cfgArr<IconItem>(s.config, "items").filter((x) => x?.title);
  const d = dark(tone);
  return (
    <section className={`section ${BG[tone]}`}>
      <div className="container-page">
        <Heading s={s} tone={tone} eyebrow="Benefícios" />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {items.map((it, i) => (
            <li key={i} className={`flex gap-4 rounded-card p-5 ${d ? "bg-white/[0.06] ring-1 ring-white/10" : tone === "mist" ? "bg-surface shadow-soft ring-1 ring-line" : "bg-mist/60"}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#3B8CEB] text-white shadow-[0_8px_18px_-8px_rgb(var(--c-primary)/0.8)]">
                <Icon name={it.icon ?? "check"} className="h-6 w-6" />
              </span>
              <div>
                <p className={`font-display text-[1.0625rem] font-semibold ${d ? "text-white" : "text-navy"}`}>{it.title}</p>
                {it.text && <p className={`mt-1 text-[15px] leading-relaxed ${d ? "text-white/70" : "text-muted"}`}>{it.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── Depoimentos (somente reais) ─────────────

function Testimonials({ s, ctx, tone }: P) {
  if (!ctx.testimonials.length) return null;
  return (
    <section className={`section ${BG[tone]}`}>
      <div className="container-page">
        <Heading s={s} tone={tone} />
        <ul className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {ctx.testimonials.map((t) => (
            <li key={t.id} className="card flex w-[85%] shrink-0 snap-start flex-col p-6 text-ink md:w-auto">
              <p className="flex gap-0.5 text-amber-500" aria-label={`Nota ${t.rating} de 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" className={`h-4 w-4 ${i < t.rating ? "fill-current" : "opacity-30"}`} />
                ))}
              </p>
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed">“{t.text}”</blockquote>
              <div className="mt-5 flex items-center gap-3">
                {t.avatarUrl ? <img src={t.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-mist font-bold text-navy">{t.name.charAt(0)}</span>}
                <div>
                  <p className="text-sm font-bold text-navy">{t.name}</p>
                  {t.city && <p className="text-xs text-muted">{t.city}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── Ofertas ─────────────

function Offers({ s, ctx, tone }: P) {
  const p = ctx.product;
  if (!p?.offers.length) return null;
  const d = dark(tone);
  const volume = p.specs.find((x) => /conte|volume/i.test(x.label))?.value ?? null;
  const base = p.offers.find((o) => o.quantity === 1)?.priceCents ?? null;
  return (
    <section id="ofertas" className={`section relative overflow-hidden ${BG[tone]}`}>
      {d && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgb(var(--c-primary)/0.35),transparent_70%)]" />}
      <div className="container-page relative">
        <Heading s={s} tone={tone} center eyebrow="Kits e preços" />
        <div className="mt-5 flex justify-center"><ShippingStrip ctx={ctx} tone={tone} /></div>
        <ul className={`mx-auto mt-10 grid max-w-5xl gap-5 ${p.offers.length >= 3 ? "md:grid-cols-3" : p.offers.length === 2 ? "md:grid-cols-2" : "max-w-md"} md:items-center`}>
          {p.offers.map((o) => {
            const disc = offerDiscountLabel(o);
            const hint = ctx.crediarioHint(o.priceCents);
            const save = o.compareAtPriceCents ? o.compareAtPriceCents - o.priceCents : null;
            const img = o.imageUrl || productImg(ctx);
            return (
              <li key={o.id} className={`relative flex flex-col overflow-hidden rounded-[1.5rem] bg-surface text-ink ${o.highlight ? "order-first shadow-[0_30px_60px_-25px_rgba(0,0,0,0.55)] ring-2 ring-primary md:order-none md:scale-[1.04]" : "shadow-lift ring-1 ring-line"}`}>
                <ViewTracker id={`offer-${o.id}`} event="offer_view" productId={p.id} offerId={o.id} valueCents={o.priceCents} />
                {o.badge && <span className={`absolute inset-x-0 top-0 z-10 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white ${o.highlight ? "bg-primary" : "bg-navy"}`}>{o.badge}</span>}
                <div className={`relative bg-white px-6 ${o.badge ? "pt-10" : "pt-6"}`}>
                  {img && <ProductStack src={img} alt={`${p.name} — ${o.name}`} count={o.quantity} className="mx-auto aspect-[1/0.82] w-full max-w-[17rem]" />}
                  {o.quantity > 1 && <span className="absolute bottom-1 left-5 z-10 grid h-11 w-11 place-items-center rounded-full bg-navy font-display text-base font-semibold text-white shadow-lift ring-4 ring-surface">×{o.quantity}</span>}
                </div>
                <div className="flex flex-1 flex-col p-6 pt-4">
                  <p className="font-display text-xl font-semibold text-navy">{o.name}</p>
                  <p className="text-sm text-muted">
                    {o.quantity} {o.quantity === 1 ? "frasco" : "frascos"}
                    {volume ? ` de ${volume}` : ""}
                    {o.description ? ` · ${o.description}` : ""}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      {o.compareAtPriceCents && <p className="text-sm text-muted line-through">{formatBRL(o.compareAtPriceCents)}</p>}
                      <p className="font-display text-[2.1rem] font-semibold leading-none tracking-tight text-navy">{formatBRL(o.priceCents)}</p>
                    </div>
                    {disc && <span className="rounded-lg bg-success/10 px-2 py-1 text-sm font-bold text-success">{disc}</span>}
                  </div>
                  <div className="mt-3 space-y-1 text-[13px]">
                    {o.quantity > 1 && <p className="font-semibold text-primary">{formatBRL(o.unitPriceCents)} por frasco{base && base > o.unitPriceCents ? ` (em vez de ${formatBRL(base)})` : ""}</p>}
                    {save != null && save > 0 && <p className="font-semibold text-success">Você economiza {formatBRL(save)}</p>}
                    {(ctx.pixLabel || hint) && <p className="text-muted">{[ctx.pixLabel && `à vista no ${ctx.pixLabel}`, hint].filter(Boolean).join(" ")}</p>}
                  </div>
                  <OfferLink href={`/checkout?oferta=${o.slug}`} offerId={o.id} productId={p.id} valueCents={o.priceCents} cta={`offer_${o.slug}`} className={`${o.highlight ? "btn-primary" : "btn-navy"} mt-5 w-full`}>
                    {s.ctaLabel || "Comprar"}
                  </OfferLink>
                </div>
              </li>
            );
          })}
        </ul>
        <ul className={`mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium ${d ? "text-white/75" : "text-muted"}`}>
          <li className="flex items-center gap-1.5"><Icon name="lock" className="h-4 w-4" /> Pagamento protegido</li>
          {ctx.pixLabel && <li className="flex items-center gap-1.5"><Icon name="pix" className="h-4 w-4" /> {ctx.pixLabel} com confirmação automática</li>}
          <li className="flex items-center gap-1.5"><Icon name="shield" className="h-4 w-4" /> Seus dados não são compartilhados</li>
        </ul>
      </div>
    </section>
  );
}

// ───────────── FAQ ─────────────

function FaqSection({ s, ctx, tone }: P) {
  if (!ctx.faqs.length) return null;
  return (
    <section id="faq" className={`section ${BG[tone]}`}>
      <div className="container-page grid gap-8 md:grid-cols-[1fr_1.6fr] md:gap-14">
        <Heading s={s} tone={tone} eyebrow="Dúvidas" />
        <div className="space-y-3 text-ink">
          {ctx.faqs.map((f, i) => (
            <FaqItem key={f.id} q={f.question} a={f.answer} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── Confiança ─────────────

function Trust({ s, tone }: P) {
  const items = cfgArr<IconItem>(s.config, "items").filter((x) => x?.title);
  const d = dark(tone);
  return (
    <section className={`section ${BG[tone]}`}>
      <div className="container-page">
        <Heading s={s} tone={tone} center />
        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          {items.map((it, i) => (
            <li key={i} className={`flex flex-col rounded-card p-4 sm:p-6 ${d ? "bg-white/[0.06] ring-1 ring-white/10" : tone === "mist" ? "bg-surface shadow-soft ring-1 ring-line" : "bg-mist/60"}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-full ${d ? "bg-white/10 text-sky-300" : "bg-primary/10 text-primary"}`}>
                <Icon name={it.icon ?? "shield"} className="h-6 w-6" />
              </span>
              <p className={`mt-4 text-[15px] font-semibold leading-snug ${d ? "text-white" : "text-navy"}`}>{it.title}</p>
              {it.text && <p className={`mt-1.5 text-[13px] leading-relaxed ${d ? "text-white/65" : "text-muted"}`}>{it.text}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── CTA final ─────────────

function FinalCta({ s, ctx, tone }: P) {
  const img = s.imageUrl || productImg(ctx);
  const d = dark(tone);
  return (
    <section className={`relative overflow-hidden ${BG[tone]}`}>
      {d && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_60%_at_80%_50%,rgb(var(--c-primary)/0.35),transparent_70%)]" />}
      <div className="container-page relative grid items-center gap-6 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
        {img && (
          <Stage tone="onDark" className="mx-auto aspect-square w-full max-w-[16rem] md:order-2 md:max-w-[22rem]">
            <ProductStack src={img} alt={productAlt(ctx)} className="absolute inset-x-0 bottom-[8%] top-[6%]" />
          </Stage>
        )}
        <div className="text-center md:text-left">
          <h2 className={`h-section ${d ? "!text-white" : ""}`}>{s.title}</h2>
          {s.subtitle && <p className={`mt-3 text-lg ${d ? "text-white/75" : "text-muted"}`}>{s.subtitle}</p>}
          <a href={s.ctaTarget || "#ofertas"} data-cta="final_cta" className="btn-primary mt-8 w-full sm:w-auto sm:px-10">
            {s.ctaLabel || "Comprar"}
          </a>
          <div className="mt-4 flex justify-center md:justify-start"><ShippingStrip ctx={ctx} tone={tone} /></div>
        </div>
      </div>
    </section>
  );
}

const RENDERERS: Record<string, (p: P) => React.ReactNode> = {
  hero: Hero,
  pain: Pain,
  solution: Solution,
  how_it_works: HowItWorks,
  demo: Demo,
  benefits: Benefits,
  testimonials: Testimonials,
  offers: Offers,
  faq: FaqSection,
  trust: Trust,
  final_cta: FinalCta,
};

/** Cor padrão de cada tipo de seção (o admin pode trocar em "Fundo"). */
export const DEFAULT_TONE: Record<string, Tone> = {
  hero: "white",
  pain: "navy",
  solution: "white",
  how_it_works: "mist",
  demo: "white",
  benefits: "white",
  testimonials: "mist",
  offers: "navy",
  faq: "mist",
  trust: "white",
  final_cta: "navy",
};

/** Seções que realmente aparecem (sem conteúdo real, algumas ficam ocultas). */
export function isVisible(s: SectionData, ctx: LandingCtx) {
  if (!s.active || !RENDERERS[s.type]) return false;
  if (s.type === "demo") return hasDemo(s, ctx);
  if (s.type === "testimonials") return ctx.testimonials.length > 0;
  if (s.type === "faq") return ctx.faqs.length > 0;
  if (s.type === "offers") return Boolean(ctx.product?.offers.length);
  return true;
}

/**
 * Fundo de cada seção visível: escolha do admin (config.tone) ou padrão do tipo. No automático,
 * alterna branco/cinza para nunca deixar duas seções seguidas com a mesma cor.
 */
export function assignTones(sections: SectionData[]): Tone[] {
  const out: Tone[] = [];
  sections.forEach((s, i) => {
    const chosen = cfgStr(s.config, "tone");
    const manual = chosen === "white" || chosen === "mist" || chosen === "navy";
    let t: Tone = manual ? (chosen as Tone) : DEFAULT_TONE[s.type] ?? "white";
    if (!manual && i > 0 && out[i - 1] === t) t = t === "mist" ? "white" : "mist";
    out.push(t);
  });
  return out;
}

export function LandingSection({ s, ctx, tone }: P) {
  const R = RENDERERS[s.type];
  return R ? <R s={s} ctx={ctx} tone={tone} /> : null;
}
