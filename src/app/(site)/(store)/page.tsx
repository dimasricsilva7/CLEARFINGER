import { LandingSection, type LandingCtx } from "@/components/landing/Sections";
import { ScrollDepth } from "@/components/landing/client";
import { StickyCta } from "@/components/layout/StickyCta";
import { crediarioConfig, installmentOptions } from "@/lib/crediario";
import { getMainProduct } from "@/server/catalog";
import { getFaqs, getLandingSections, getTestimonials, loadFaqsDirect, loadLandingSectionsDirect, loadTestimonialsDirect, safeLoad } from "@/server/landing";
import { getSettings, isOn } from "@/server/settings";

export const revalidate = 300;

/** Landing page: todo o conteúdo vem do banco (CMS) e é atualizado pelo admin sem deploy. */
export default async function Home() {
  const [s, sections, product, faqs, testimonials] = await Promise.all([
    getSettings(),
    safeLoad(getLandingSections, loadLandingSectionsDirect, []),
    getMainProduct(),
    safeLoad(getFaqs, loadFaqsDirect, []),
    safeLoad(getTestimonials, loadTestimonialsDirect, []),
  ]);
  const cfg = crediarioConfig(s);
  const crediarioHint = (cents: number) => {
    if (!cfg.enabled) return null;
    const opts = installmentOptions(cents, cfg);
    const last = opts.at(-1);
    return last ? `ou ${last.label} no ${cfg.methodLabel.toLowerCase()}` : null;
  };
  const ctx: LandingCtx = { product, faqs, testimonials, crediarioHint, pixLabel: isOn(s.pix_enabled) ? s.pix_method_label || "PIX" : null };

  return (
    <>
      {sections.filter((x) => x.active).map((x) => (
        <LandingSection key={x.key} s={x} ctx={ctx} />
      ))}
      <ScrollDepth />
      {isOn(s.sticky_cta_enabled) && <StickyCta label={s.sticky_cta_label || "Comprar"} priceText={null} />}
    </>
  );
}
