export type Touch = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  /** utm_id / campaign_id — ID da campanha no gerenciador de anúncios */
  id?: string | null;
  at?: number;
};

export type Attribution = {
  first?: Touch | null;
  last?: Touch | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  adset?: string | null;
  ad?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
};

export type ClientContext = {
  sessionId?: string | null;
  visitorId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  attribution?: Attribution | null;
  adsConsent?: boolean;
};
