/* eslint-disable @next/next/no-img-element */
import type { Faq, Testimonial } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";
import { cfgArr, cfgStr, type SectionData } from "@/server/landing";
import { offerDiscountLabel } from "@/lib/pricing";
import { formatBRL } from "@/utils/format";
import type { IconItem } from "@/lib/domain";
import type { PublicProduct } from "@/types/catalog";
import { DemoVideo, FaqItem, OfferLink, ViewTracker } from "./client";

export type LandingCtx = {
  product: PublicProduct | null;
  faqs: Faq[];
  testimonials: Testimonial[];
  /** "ou 2x de R$ 29,95 no crediário" para um valor (null se o crediário estiver desligado) */
  crediarioHint: (cents: number) => string | null;
  pixLabel: string | null;
};

const paragraphs = (body: string | null) => (body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function Heading({ s, center = false, light = false }: { s: SectionData; center?: boolean; light?: boolean }) {
  const eyebrow = cfgStr(s.config, "eyebrow");
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className={`eyebrow ${light ? "text-sky-300" : ""}`}>{eyebrow}</p>}
      {s.title && <h2 className={`h-section mt-2 ${light ? "text-white" : ""}`}>{s.title}</h2>}
      {s.subtitle && <p className={`lead mt-3 ${light ? "text-white/75" : ""}`}>{s.subtitle}</p>}
    </div>
  );
}

// ───────────── Primeira tela ─────────────

function Hero({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const p = ctx.product;
  const offers = p?.offers ?? [];
  const entry = offers.length ? offers.reduce((a, b) => (b.priceCents < a.priceCents ? b : a)) : null;
  const img = s.imageUrl || p?.mainImage?.url || null;
  const badges = cfgArr<string>(s.config, "badges").filter(Boolean).slice(0, 4);
  const hint = entry ? ctx.crediarioHint(entry.priceCents) : null;
  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(70%_60%_at_85%_20%,rgb(var(--c-primary)/0.10),transparent)]" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-6 pb-10 pt-6 sm:pt-10 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pb-16 lg:pt-14">
        <div>
          {cfgStr(s.config, "eyebrow") && <p className="eyebrow">{cfgStr(s.config, "eyebrow")}</p>}
          <h1 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.08] text-navy sm:text-5xl lg:text-[3.35rem]">{s.title}</h1>
          {s.subtitle && <p className="mt-3 max-w-xl text-base leading-relaxed text-muted sm:mt-4 sm:text-lg">{s.subtitle}</p>}

          {/* Produto aparece já na primeira dobra no celular */}
          {img && (
            <ViewTracker
              id="hero-product-m"
              event="product_view"
              productId={p?.id}
              valueCents={entry?.priceCents}
              meta={p ? { name: "ViewContent", params: { content_ids: [p.sku], content_name: p.name, content_type: "product", value: (entry?.priceCents ?? p.priceCents) / 100, currency: "BRL" } } : null}
              className="relative mt-5 md:hidden"
            >
              <div className="mx-auto flex max-w-[22rem] items-center justify-center rounded-card bg-mist/70 p-3">
                <img src={img} alt={p?.mainImage?.alt ?? p?.name ?? "CLEARFINGER"} className="h-auto max-h-[13.5rem] w-auto object-contain mix-blend-multiply" width={1200} height={1096} fetchPriority="high" />
              </div>
            </ViewTracker>
          )}

          {entry && (
            <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{offers.length > 1 ? "A partir de" : "Por"}</p>
                <p className="font-display text-[2rem] font-bold leading-none text-navy">
                  {formatBRL(entry.priceCents)}
                  {entry.compareAtPriceCents && <s className="ml-2 align-middle text-base font-medium text-muted">{formatBRL(entry.compareAtPriceCents)}</s>}
                </p>
              </div>
              {hint && <p className="pb-1 text-sm font-medium text-muted">{hint}</p>}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a id="hero-cta" href={s.ctaTarget || "#ofertas"} data-cta="hero_cta" className="btn-primary w-full sm:w-auto sm:px-8">
              {s.ctaLabel || "Comprar"}
            </a>
            <a href="#como-funciona" data-cta="hero_secondary" className="btn-ghost hidden sm:inline-flex">
              Como funciona
            </a>
          </div>
          {badges.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-navy/80">
              {badges.map((b, i) => (
                <li key={b} className="flex items-center gap-1.5">
                  <Icon name={["lock", "pix", "shield", "truck"][i] ?? "check"} className="h-4 w-4 text-primary" strokeWidth={2} />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {img && (
          <ViewTracker
            id="hero-product"
            event="product_view"
            productId={p?.id}
            valueCents={entry?.priceCents}
            meta={p ? { name: "ViewContent", params: { content_ids: [p.sku], content_name: p.name, content_type: "product", value: (entry?.priceCents ?? p.priceCents) / 100, currency: "BRL" } } : null}
            className="hidden md:block"
          >
            <div className="relative mx-auto max-w-[34rem] rounded-[2rem] bg-gradient-to-b from-mist to-surface p-6 lg:p-8">
              <img src={img} alt={p?.mainImage?.alt ?? p?.name ?? "CLEARFINGER"} className="h-auto w-full object-contain mix-blend-multiply" width={1200} height={1096} fetchPriority="high" />
            </div>
          </ViewTracker>
        )}
      </div>
    </section>
  );
}

// ───────────── Dor / identificação ─────────────

function Pain({ s }: { s: SectionData }) {
  const items = cfgArr<string>(s.config, "items").filter(Boolean);
  return (
    <section className="section bg-mist/60">
      <div className="container-page grid gap-8 md:grid-cols-2 md:gap-14">
        <div>
          <h2 className="h-section">{s.title}</h2>
          {s.subtitle && <p className="lead mt-3">{s.subtitle}</p>}
        </div>
        <div>
          {paragraphs(s.body).map((p, i) => (
            <p key={i} className={`text-[1.0625rem] leading-relaxed ${i === 0 ? "font-medium text-navy" : "mt-4 text-muted"}`}>
              {p}
            </p>
          ))}
          {items.length > 0 && (
            <ul className="mt-6 space-y-3 border-l-2 border-primary/40 pl-5">
              {items.map((it) => (
                <li key={it} className="text-[15px] text-navy">{it}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── Solução ─────────────

function Solution({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const points = cfgArr<string>(s.config, "points").filter(Boolean);
  const img = s.imageUrl || ctx.product?.secondaryImage?.url || ctx.product?.mainImage?.url;
  const sameAsHero = img === ctx.product?.mainImage?.url;
  return (
    <section className="section bg-surface">
      <div className="container-page grid items-center gap-10 md:grid-cols-2 md:gap-14">
        {img && (
          <div className={`order-2 rounded-[2rem] bg-mist/70 p-5 md:order-1 md:block md:p-8 ${sameAsHero ? "hidden" : ""}`}>
            <img src={img} alt={ctx.product?.name ?? ""} className="mx-auto h-auto max-h-[26rem] w-auto object-contain mix-blend-multiply" loading="lazy" width={1200} height={1096} />
          </div>
        )}
        <div className="order-1 md:order-2">
          <h2 className="h-section">{s.title}</h2>
          {paragraphs(s.body).map((p, i) => (
            <p key={i} className="lead mt-4">{p}</p>
          ))}
          {points.length > 0 && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-[15px] font-semibold text-navy">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
          )}
          {s.ctaLabel && (
            <a href={s.ctaTarget || "#ofertas"} data-cta="solution_cta" className="btn-navy mt-8 w-full sm:w-auto">
              {s.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── Como funciona ─────────────

function HowItWorks({ s }: { s: SectionData }) {
  const steps = cfgArr<{ title: string; text?: string }>(s.config, "steps").filter((x) => x?.title);
  const note = cfgStr(s.config, "note");
  return (
    <section id="como-funciona" className="section bg-navy text-white">
      <div className="container-page">
        <Heading s={s} light />
        <ol className="mt-10 grid gap-px overflow-hidden rounded-card bg-white/10 md:grid-cols-3">
          {steps.map((st, i) => (
            <li key={i} className="bg-navy p-6 sm:p-8">
              <p className="font-display text-sm font-semibold tracking-[0.2em] text-sky-300">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 font-display text-2xl font-semibold uppercase tracking-wide">{st.title}</p>
              {st.text && <p className="mt-3 leading-relaxed text-white/75">{st.text}</p>}
            </li>
          ))}
        </ol>
        {note && <p className="mt-5 text-sm text-white/60">{note}</p>}
      </div>
    </section>
  );
}

// ───────────── Demonstração ─────────────

function Demo({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const video = s.videoUrl || ctx.product?.videoUrl || null;
  const steps = [
    { label: "Antes", url: cfgStr(s.config, "beforeUrl") },
    { label: "Aplicação", url: cfgStr(s.config, "applicationUrl") },
    { label: "Depois", url: cfgStr(s.config, "afterUrl") },
  ].filter((x) => x.url);
  const single = s.imageUrl;
  if (!video && !steps.length && !single) return null; // sem material real, a seção não aparece
  const caption = cfgStr(s.config, "caption");
  return (
    <section className="section bg-surface">
      <div className="container-page">
        <Heading s={s} center />
        <div className={`mt-10 grid items-start gap-8 ${video && (steps.length || single) ? "md:grid-cols-[320px_1fr]" : ""}`}>
          {video && <DemoVideo url={video} poster={cfgStr(s.config, "posterUrl")} label={s.title ?? "Demonstração"} />}
          {steps.length > 0 ? (
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {steps.map((st) => (
                <li key={st.label} className="overflow-hidden rounded-card border border-line bg-mist/50">
                  <img src={st.url} alt={st.label} className="aspect-square w-full object-cover" loading="lazy" />
                  <p className="px-4 py-3 text-sm font-bold uppercase tracking-wider text-navy">{st.label}</p>
                </li>
              ))}
            </ol>
          ) : (
            single && <img src={single} alt={s.title ?? ""} className="mx-auto w-full max-w-2xl rounded-card" loading="lazy" />
          )}
        </div>
        {caption && <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted">{caption}</p>}
      </div>
    </section>
  );
}

// ───────────── Benefícios ─────────────

function Benefits({ s }: { s: SectionData }) {
  const items = cfgArr<IconItem>(s.config, "items").filter((x) => x?.title);
  return (
    <section className="section bg-mist/60">
      <div className="container-page">
        <Heading s={s} />
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary/25 bg-surface text-primary">
                <Icon name={it.icon ?? "check"} className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-[1.0625rem] font-semibold text-navy">{it.title}</p>
                {it.text && <p className="mt-1 text-[15px] leading-relaxed text-muted">{it.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── Depoimentos (somente reais) ─────────────

function Testimonials({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  if (!ctx.testimonials.length) return null;
  return (
    <section className="section bg-surface">
      <div className="container-page">
        <Heading s={s} />
        <ul className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {ctx.testimonials.map((t) => (
            <li key={t.id} className="card flex w-[85%] shrink-0 snap-start flex-col p-6 md:w-auto">
              <p className="flex gap-0.5 text-primary" aria-label={`Nota ${t.rating} de 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" className={`h-4 w-4 ${i < t.rating ? "fill-current" : "opacity-30"}`} />
                ))}
              </p>
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">“{t.text}”</blockquote>
              <div className="mt-5 flex items-center gap-3">
                {t.avatarUrl ? (
                  <img src={t.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-mist font-bold text-navy">{t.name.charAt(0)}</span>
                )}
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

function Offers({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const p = ctx.product;
  if (!p?.offers.length) return null;
  return (
    <section id="ofertas" className="section bg-mist/60">
      <div className="container-page">
        <Heading s={s} center />
        <ul className={`mx-auto mt-10 grid max-w-5xl gap-4 sm:gap-5 ${p.offers.length >= 3 ? "md:grid-cols-3" : p.offers.length === 2 ? "md:grid-cols-2" : "max-w-md"}`}>
          {p.offers.map((o) => {
            const disc = offerDiscountLabel(o);
            const hint = ctx.crediarioHint(o.priceCents);
            return (
              <li key={o.id} className={`relative flex flex-col rounded-card bg-surface p-6 ${o.highlight ? "border-2 border-primary shadow-lift md:-mt-3 md:pb-9" : "border border-line shadow-soft"}`}>
                <ViewTracker id={`offer-${o.id}`} event="offer_view" productId={p.id} offerId={o.id} valueCents={o.priceCents} />
                {o.badge && <span className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold ${o.highlight ? "bg-primary text-white" : "bg-navy text-white"}`}>{o.badge}</span>}
                <div className="flex items-center gap-4">
                  {(o.imageUrl || p.mainImage) && <img src={o.imageUrl || p.mainImage!.url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-mist object-contain p-1 mix-blend-multiply" loading="lazy" />}
                  <div>
                    <p className="font-display text-lg font-semibold text-navy">{o.name}</p>
                    <p className="text-sm text-muted">{o.quantity} {o.quantity === 1 ? "frasco" : "frascos"} de {p.specs.find((x) => /conte|volume/i.test(x.label))?.value ?? "30 mL"}</p>
                  </div>
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  {o.compareAtPriceCents && (
                    <p className="text-sm text-muted">
                      De <s>{formatBRL(o.compareAtPriceCents)}</s>
                      {disc && <span className="ml-2 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">{disc}</span>}
                    </p>
                  )}
                  <p className="mt-1 font-display text-[2rem] font-bold leading-none text-navy">{formatBRL(o.priceCents)}</p>
                  {ctx.pixLabel && <p className="mt-1.5 text-sm text-muted">no {ctx.pixLabel}{hint ? ` ${hint}` : ""}</p>}
                  {!ctx.pixLabel && hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
                  {o.quantity > 1 && <p className="mt-2 text-sm font-semibold text-primary">{formatBRL(o.unitPriceCents)} por frasco</p>}
                </div>
                {o.description && <p className="mt-4 text-[15px] text-muted">{o.description}</p>}
                <OfferLink href={`/checkout?oferta=${o.slug}`} offerId={o.id} productId={p.id} valueCents={o.priceCents} cta={`offer_${o.slug}`} className={`${o.highlight ? "btn-primary" : "btn-navy"} mt-6 w-full`}>
                  {s.ctaLabel || "Comprar"}
                </OfferLink>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted">
          <Icon name="lock" className="h-4 w-4 text-primary" /> Pagamento protegido · seus dados não são compartilhados
        </p>
      </div>
    </section>
  );
}

// ───────────── FAQ ─────────────

function FaqSection({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  if (!ctx.faqs.length) return null;
  return (
    <section id="faq" className="section bg-surface">
      <div className="container-page grid gap-8 md:grid-cols-[1fr_1.6fr] md:gap-14">
        <Heading s={s} />
        <div className="space-y-3">
          {ctx.faqs.map((f, i) => (
            <FaqItem key={f.id} q={f.question} a={f.answer} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── Confiança ─────────────

function Trust({ s }: { s: SectionData }) {
  const items = cfgArr<IconItem>(s.config, "items").filter((x) => x?.title);
  return (
    <section className="section bg-mist/60">
      <div className="container-page">
        <Heading s={s} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <li key={i} className="rounded-card border border-line bg-surface p-5">
              <Icon name={it.icon ?? "shield"} className="h-7 w-7 text-primary" />
              <p className="mt-3 font-semibold text-navy">{it.title}</p>
              {it.text && <p className="mt-1 text-sm leading-relaxed text-muted">{it.text}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── CTA final ─────────────

function FinalCta({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const img = s.imageUrl || ctx.product?.mainImage?.url;
  return (
    <section className="bg-navy">
      <div className="container-page grid items-center gap-8 py-14 md:grid-cols-[1.3fr_1fr] md:py-16">
        <div>
          <h2 className="h-section text-white">{s.title}</h2>
          {s.subtitle && <p className="mt-3 text-lg text-white/75">{s.subtitle}</p>}
          <a href={s.ctaTarget || "#ofertas"} data-cta="final_cta" className="btn-primary mt-8 w-full sm:w-auto sm:px-10">
            {s.ctaLabel || "Comprar"}
          </a>
        </div>
        {img && (
          <div className="hidden rounded-[2rem] bg-white p-6 md:block">
            <img src={img} alt="" className="mx-auto h-auto max-h-72 w-auto object-contain" loading="lazy" />
          </div>
        )}
      </div>
    </section>
  );
}

const RENDERERS: Record<string, (p: { s: SectionData; ctx: LandingCtx }) => React.ReactNode> = {
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

export function LandingSection({ s, ctx }: { s: SectionData; ctx: LandingCtx }) {
  const R = RENDERERS[s.type];
  return R ? <R s={s} ctx={ctx} /> : null;
}
