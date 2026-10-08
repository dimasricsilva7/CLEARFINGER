import { Analytics } from "@/components/providers/Analytics";
import { CookieBanner } from "@/components/providers/CookieBanner";
import { getSettings, googleIds, isOn, trackingIds } from "@/server/settings";

/** Providers da loja e do checkout (analytics, consentimento). O admin não usa. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const ids = trackingIds(settings);
  const g = googleIds(settings);
  const bannerEnabled = isOn(settings.cookie_banner_enabled);
  return (
    <>
      {children}
      <Analytics metaPixelIds={ids.metaPixelIds} gaId={ids.gaId} gtmId={g.gtmId} adsId={g.adsId} bannerEnabled={bannerEnabled} />
      {bannerEnabled && <CookieBanner />}
    </>
  );
}
