export const CHANNELS = ["facebook", "instagram", "google", "tiktok", "organico", "direto", "outros"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  tiktok: "TikTok",
  organico: "Orgânico",
  direto: "Direto",
  outros: "Outros",
};

const SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu)\./i;

/** Classifica a origem do tráfego a partir de UTM, click IDs e referrer. */
export function classifyChannel(input: {
  source?: string | null;
  medium?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  referrer?: string | null;
  siteHost?: string | null;
}): Channel {
  const src = (input.source ?? "").toLowerCase().trim();
  if (src) {
    if (/^(ig|instagram)/.test(src)) return "instagram";
    if (/^(fb|facebook|meta)/.test(src)) return "facebook";
    if (/^(google|gads|adwords|youtube)/.test(src)) return "google";
    if (/^(tiktok|tt)/.test(src)) return "tiktok";
    return "outros";
  }
  if (input.fbclid) return "facebook";
  if (input.gclid) return "google";
  if (input.ttclid) return "tiktok";

  let host = "";
  try {
    host = input.referrer ? new URL(input.referrer).hostname : "";
  } catch {
    host = "";
  }
  if (!host || (input.siteHost && host === input.siteHost)) return "direto";
  if (/instagram\.com$/i.test(host)) return "instagram";
  if (/(facebook\.com|fb\.com|fb\.me)$/i.test(host)) return "facebook";
  if (/tiktok\.com$/i.test(host)) return "tiktok";
  if (SEARCH_ENGINES.test(host)) return "organico";
  return "outros";
}

export function parseUserAgent(ua: string | null | undefined) {
  const s = ua ?? "";
  const device = /iPad|Tablet/i.test(s) ? "tablet" : /Mobi|Android|iPhone/i.test(s) ? "mobile" : s ? "desktop" : "desconhecido";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /FBAN|FBAV|Instagram/.test(s)
          ? "In-app (Meta)"
          : /Chrome\//.test(s)
            ? "Chrome"
            : /Firefox\//.test(s)
              ? "Firefox"
              : /Safari\//.test(s)
                ? "Safari"
                : "Outro";
  const os = /Windows/.test(s)
    ? "Windows"
    : /iPhone|iPad|iOS/.test(s)
      ? "iOS"
      : /Android/.test(s)
        ? "Android"
        : /Mac OS X/.test(s)
          ? "macOS"
          : /Linux/.test(s)
            ? "Linux"
            : "Outro";
  const isBot = /bot|crawler|spider|crawling|facebookexternalhit|preview|lighthouse|headless/i.test(s);
  return { device, browser, os, isBot };
}
