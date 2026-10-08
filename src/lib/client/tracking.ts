"use client";

import type { Attribution, ClientContext, Touch } from "@/types/tracking";

/**
 * Tracking no navegador:
 * - session_id (expira após 30 min sem atividade) e visitor_id (1 ano, definido pelo middleware)
 * - captura de UTMs e click IDs (fbclid, gclid, ttclid) com first-touch e last-touch
 * - fila de eventos próprios enviada em lote para /api/track
 * - Meta Pixel / GA4 ativos por padrão (modelo de recusa), com o mesmo event_id enviado à CAPI
 */

const SESSION_TTL = 30 * 60 * 1000;
const ATTR_KEY = "cf_attr";
const CONSENT_COOKIE = "cf_consent";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado */
  }
}

export function randomId(len = 20) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
}

export function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function writeCookie(name: string, value: string, maxAgeSec: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function getIds() {
  let vid = readCookie("cf_vid");
  if (!vid) {
    vid = randomId(20);
    writeCookie("cf_vid", vid, 365 * 24 * 3600);
  }
  let sid = readCookie("cf_sid");
  const last = Number(safeGet("cf_sid_ts") ?? 0);
  if (!sid || Date.now() - last > SESSION_TTL) sid = randomId(20);
  writeCookie("cf_sid", sid, SESSION_TTL / 1000);
  safeSet("cf_sid_ts", String(Date.now()));
  return { sid, vid };
}

function readAttribution(): Attribution {
  try {
    return JSON.parse(safeGet(ATTR_KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

/** A cada navegação: atualiza last-touch quando há UTMs novos e preserva o first-touch. */
export function captureAttribution() {
  const url = new URL(location.href);
  const attr = readAttribution();
  const touch: Touch = {};
  let hasUtm = false;
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(k);
    if (v) {
      touch[k.replace("utm_", "") as "source"] = v.slice(0, 200);
      hasUtm = true;
    }
  }
  const fbclid = url.searchParams.get("fbclid");
  const gclid = url.searchParams.get("gclid");
  const ttclid = url.searchParams.get("ttclid");
  const adset = url.searchParams.get("adset") || url.searchParams.get("adset_name") || url.searchParams.get("adset_id");
  const ad = url.searchParams.get("ad") || url.searchParams.get("ad_name") || url.searchParams.get("ad_id");
  if (adset) attr.adset = adset.slice(0, 200);
  if (ad) attr.ad = ad.slice(0, 200);
  const externalReferrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : null;

  if (hasUtm) {
    touch.at = Date.now();
    attr.last = touch;
    if (!attr.first) attr.first = touch;
  }
  if (fbclid) {
    attr.fbclid = fbclid.slice(0, 500);
    if (!readCookie("_fbc")) writeCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90 * 24 * 3600);
  }
  if (gclid) attr.gclid = gclid.slice(0, 500);
  if (ttclid) attr.ttclid = ttclid.slice(0, 500);
  if (!attr.landingPage || hasUtm || fbclid || gclid || ttclid) {
    attr.landingPage = (url.pathname + url.search).slice(0, 500);
    if (externalReferrer) attr.referrer = externalReferrer.slice(0, 500);
  }
  if (!attr.referrer && externalReferrer) attr.referrer = externalReferrer.slice(0, 500);
  safeSet(ATTR_KEY, JSON.stringify(attr));
  return attr;
}

// ───────────── Consentimento ─────────────

type ConsentState = "granted" | "denied" | null;
let bannerEnabled = true;
export function configureConsent(enabled: boolean) {
  bannerEnabled = enabled;
}
export const getConsent = (): ConsentState => (readCookie(CONSENT_COOKIE) as ConsentState) ?? null;
/** Modelo de recusa: medição/marketing ativos por padrão; desligados se o visitante recusar. */
export const adsAllowed = () => !bannerEnabled || getConsent() !== "denied";
export function setConsent(v: "granted" | "denied") {
  writeCookie(CONSENT_COOKIE, v, 365 * 24 * 3600);
  // Recusou com o Pixel já carregado nesta página: a Meta para de registrar a partir daqui
  if (v === "denied" && typeof window.fbq === "function") window.fbq("consent", "revoke");
  if (v === "granted" && typeof window.fbq === "function") window.fbq("consent", "grant");
  window.dispatchEvent(new CustomEvent("cf:consent", { detail: v }));
}

// ───────────── Contexto (vai para o checkout e para /api/track) ─────────────

export function getClientContext(): ClientContext {
  const { sid, vid } = getIds();
  return { sessionId: sid, visitorId: vid, fbp: readCookie("_fbp"), fbc: readCookie("_fbc"), attribution: readAttribution(), adsConsent: adsAllowed() };
}

// ───────────── Fila de eventos próprios ─────────────

type CapiForward = { eventName: string; eventId: string; url: string; customData?: Record<string, unknown> };
export type TrackData = {
  productId?: string | null;
  offerId?: string | null;
  valueCents?: number | null;
  element?: string | null;
  props?: Record<string, string | number | boolean | null>;
  capi?: CapiForward;
};
type QueuedEvent = TrackData & { name: string; path?: string };

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  const { sessionId, visitorId, ...rest } = getClientContext();
  const body = JSON.stringify({ sid: sessionId, vid: visitorId, context: rest, events });
  const blob = new Blob([body], { type: "application/json" });
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track", blob))) {
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
  if (queue.length) flush();
}

export function track(name: string, data: TrackData = {}) {
  if (typeof window === "undefined") return;
  queue.push({ name, path: location.pathname + location.search, ...data });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

/** Dispara no máximo uma vez por sessão (ex.: order_bump_view, video_25). */
const onceKeys = new Set<string>();
export function trackOnce(key: string, name: string, data: TrackData = {}) {
  if (onceKeys.has(key)) return;
  onceKeys.add(key);
  track(name, data);
}

if (typeof window !== "undefined") {
  addEventListener("pagehide", flush);
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

// ───────────── Meta Pixel / GA4 ─────────────

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function newEventId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomId(8)}`;
}

/**
 * Evento no Meta Pixel + (opcional) espelho na CAPI via /api/track com o MESMO
 * event_id — a Meta deduplica. Se o visitante recusar, nada é enviado à Meta.
 */
export function metaEvent(eventName: string, params: Record<string, unknown> = {}, opts: { eventId?: string; mirror?: boolean; internal?: QueuedEvent } = {}) {
  const eventId = opts.eventId ?? newEventId(eventName.toLowerCase());
  const allowed = adsAllowed();
  if (allowed) {
    const fire = (tries: number) => {
      if (window.fbq) window.fbq("track", eventName, params, { eventID: eventId });
      else if (tries > 0) setTimeout(() => fire(tries - 1), 250);
    };
    fire(16);
  }
  if (opts.internal) {
    const { name, ...rest } = opts.internal;
    track(name, { ...rest, capi: allowed && opts.mirror ? { eventName, eventId, url: location.href, customData: params } : undefined });
  }
  return eventId;
}

export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (adsAllowed() && window.gtag) window.gtag("event", name, params);
}

// ───────────── Online agora (batimento) ─────────────
if (typeof window !== "undefined" && !location.pathname.startsWith("/admin")) {
  const ping = () => {
    if (document.visibilityState !== "visible") return;
    const body = JSON.stringify({ sid: getClientContext().sessionId, path: location.pathname });
    const blob = new Blob([body], { type: "application/json" });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/ping", blob))) fetch("/api/ping", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  };
  setInterval(ping, 30_000);
  addEventListener("visibilitychange", () => document.visibilityState === "visible" && ping());
}
