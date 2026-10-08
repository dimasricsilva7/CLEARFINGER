import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { SETTING_DEFAULTS } from "@/lib/settings-defaults";

export type Settings = Record<string, string>;

const toStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

async function loadStrict(): Promise<Settings> {
  const rows = await db.siteSettings.findMany(); // erro do banco lança: nunca vai para o cache
  const map: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = toStr(r.value);
  return map;
}

async function load(): Promise<Settings> {
  return loadStrict().catch(() => ({ ...SETTING_DEFAULTS }));
}

const cachedSettings = unstable_cache(loadStrict, ["cf-settings-v1"], { tags: ["settings"], revalidate: 300 });

/** Leitura com cache (páginas). Invalidada pela tag "settings" ao salvar no admin. Falha do banco → padrões, sem cachear. */
export const getSettings = (): Promise<Settings> => cachedSettings().catch(() => load());

/** Leitura sem cache (checkout, jobs, webhooks): valores sempre atuais. */
export const getSettingsFresh = load;

export function settingInt(settings: Settings, key: string, fallback: number): number {
  const n = Number.parseInt(settings[key] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export const isOn = (v: string | undefined) => v === "true";

const PIXEL_RE = /^\d{5,20}$/;
const GA_RE = /^G-[A-Z0-9]{4,15}$/;

/** Lista de pixels (até 3), separados por vírgula ou espaço. */
export function parsePixelIds(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(/[\s,;]+/).map((v) => v.trim()).filter((v) => PIXEL_RE.test(v)))].slice(0, 3);
}

/**
 * Tokens da Conversions API por pixel (somente servidor):
 *   META_CAPI_TOKENS="pixelId:token,pixelId:token"  (um token por pixel)
 *   META_ACCESS_TOKEN=token                          (fallback para qualquer pixel sem token próprio)
 */
export function capiTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (process.env.META_CAPI_TOKENS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

/** IDs de rastreamento: configuração do admin tem prioridade; env é o fallback. Sempre validados. */
export function trackingIds(s: Settings) {
  const pixels = parsePixelIds(s.meta_pixel_id || process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const ga = (s.ga_id || process.env.NEXT_PUBLIC_GA_ID || "").trim();
  const tokens = capiTokens();
  const fallback = process.env.META_ACCESS_TOKEN;
  const capiTargets = pixels.map((id) => ({ pixelId: id, token: tokens[id] || fallback || "" })).filter((t) => t.token);
  return {
    metaPixelIds: isOn(s.meta_pixel_enabled) ? pixels : [],
    gaId: isOn(s.ga_enabled) && GA_RE.test(ga) ? ga : null,
    capiEnabled: isOn(s.meta_capi_enabled) && capiTargets.length > 0,
    capiTargets,
  };
}

/** Google: GTM e Google Ads (validados; nunca scripts arbitrários). */
export function googleIds(s: Settings) {
  const gtm = (s.gtm_id || process.env.NEXT_PUBLIC_GTM_ID || "").trim().toUpperCase();
  const ads = (s.google_ads_id || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim().toUpperCase();
  const label = (s.google_ads_purchase_label || "").trim();
  return {
    gtmId: isOn(s.ga_enabled) && /^GTM-[A-Z0-9]{4,12}$/.test(gtm) ? gtm : null,
    adsId: isOn(s.ga_enabled) && /^AW-\d{6,14}$/.test(ads) ? ads : null,
    adsPurchaseLabel: /^[A-Za-z0-9_-]{4,40}$/.test(label) ? label : null,
  };
}
