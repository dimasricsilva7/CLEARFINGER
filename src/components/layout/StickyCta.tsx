"use client";

import { useEffect, useState } from "react";

/**
 * CTA fixo no mobile: aparece depois que o botão da primeira tela sai da tela e
 * some quando as ofertas ou o rodapé estão visíveis (nunca cobre o que importa).
 */
export function StickyCta({ label, priceText }: { label: string; priceText: string | null }) {
  const [heroGone, setHeroGone] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const targets = [document.getElementById("ofertas"), document.querySelector("footer")].filter(Boolean) as Element[];
    const visible = new Set<Element>();
    const io1 = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0));
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      setBlocked(visible.size > 0);
    });
    if (hero) io1.observe(hero);
    else setHeroGone(true);
    targets.forEach((t) => io2.observe(t));
    return () => {
      io1.disconnect();
      io2.disconnect();
    };
  }, []);
  if (!heroGone || blocked) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slideup border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <a href="#ofertas" data-cta="sticky_mobile_cta" className="btn-primary w-full">
        <span className="truncate">{label}</span>
        {priceText && <span className="shrink-0 font-semibold opacity-90">· {priceText}</span>}
      </a>
    </div>
  );
}
