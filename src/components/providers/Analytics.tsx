"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { adsAllowed, captureAttribution, configureConsent, getIds, metaEvent, track } from "@/lib/client/tracking";

type Props = { metaPixelIds: string[]; gaId: string | null; gtmId: string | null; adsId: string | null; bannerEnabled: boolean };

function PageTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef("");

  useEffect(() => {
    const key = `${pathname}?${search?.toString() ?? ""}`;
    if (last.current === key) return;
    last.current = key;
    captureAttribution();
    getIds();
    metaEvent("PageView", {}, { mirror: true, internal: { name: "page_view" } });
    if (adsAllowed() && window.gtag) window.gtag("event", "page_view", { page_path: pathname, page_location: location.href });
  }, [pathname, search]);

  // Cliques em elementos com data-cta (hero, ofertas, CTA fixo, checkout…)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (!el) return;
      track("cta_click", { element: el.dataset.cta ?? null, props: { label: el.textContent?.trim().slice(0, 60) ?? null } });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}

/**
 * Uma única implementação de cada tag (sem duplicação): Meta Pixel, gtag (GA4 + Google Ads) e GTM,
 * carregados só com IDs válidos configurados no admin e respeitando a recusa de cookies.
 * O analytics próprio (primeira parte) roda sempre.
 */
export function Analytics({ metaPixelIds, gaId, gtmId, adsId, bannerEnabled }: Props) {
  if (typeof window !== "undefined") configureConsent(bannerEnabled);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(adsAllowed());
    const on = () => setAllowed(adsAllowed());
    window.addEventListener("cf:consent", on);
    return () => window.removeEventListener("cf:consent", on);
  }, [bannerEnabled]);

  const loadMeta = allowed && metaPixelIds.length > 0;
  const gtagIds = [gaId, adsId].filter(Boolean) as string[];
  const loadGtag = allowed && gtagIds.length > 0;
  return (
    <>
      {loadMeta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');${metaPixelIds.map((id) => `fbq('init','${id}');`).join("")}`}
        </Script>
      )}
      {loadGtag && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`} strategy="afterInteractive" />
          <Script id="gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${gtagIds.map((id) => `gtag('config','${id}',{send_page_view:false});`).join("")}`}
          </Script>
        </>
      )}
      {allowed && gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
    </>
  );
}
