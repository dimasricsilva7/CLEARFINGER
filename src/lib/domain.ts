/**
 * Definições de domínio compartilhadas (cliente + servidor). Nada aqui contém
 * preço ou texto comercial — isso vive no banco e é editado no admin.
 */

// ───────────── Pedidos ─────────────

export const PAYMENT_METHOD_LABEL = { PIX: "PIX", CREDIARIO: "Crediário" } as const;
export type PaymentMethodKey = keyof typeof PAYMENT_METHOD_LABEL;

export const ORDER_STATUS_LABEL = {
  PENDING: "Aguardando PIX",
  PIX_GENERATED: "PIX gerado",
  PAID: "PIX pago",
  EXPIRED: "PIX expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  CHARGEBACK: "Contestação",
  FAILED: "Falhou",
  CREDIARIO_PENDENTE: "Crediário pendente",
  CREDIARIO_EM_ANALISE: "Crediário em análise",
  CREDIARIO_APROVADO: "Crediário aprovado",
  CREDIARIO_RECUSADO: "Crediário recusado",
  CREDIARIO_CANCELADO: "Crediário cancelado",
  CREDIARIO_CONCLUIDO: "Crediário concluído",
} as const;
export type OrderStatusKey = keyof typeof ORDER_STATUS_LABEL;

export const FULFILLMENT_LABEL = { PENDING: "Aguardando", PROCESSING: "Em preparação", SHIPPED: "Enviado", DELIVERED: "Entregue" } as const;
export type FulfillmentKey = keyof typeof FULFILLMENT_LABEL;

export const PIX_STATUSES = ["PENDING", "PIX_GENERATED", "PAID", "EXPIRED", "CANCELLED", "REFUNDED", "CHARGEBACK", "FAILED"] as const;
export const CREDIARIO_STATUSES = ["CREDIARIO_PENDENTE", "CREDIARIO_EM_ANALISE", "CREDIARIO_APROVADO", "CREDIARIO_RECUSADO", "CREDIARIO_CANCELADO", "CREDIARIO_CONCLUIDO"] as const;
export type CrediarioStatus = (typeof CREDIARIO_STATUSES)[number];

/** Status que contam como venda confirmada (receita): PIX pago ou crediário aprovado/concluído. */
export const PAID_STATUSES = ["PAID", "CREDIARIO_APROVADO", "CREDIARIO_CONCLUIDO"] as const;
export const AWAITING_PIX_STATUSES = ["PENDING", "PIX_GENERATED"] as const;
export const isPaidStatus = (s: string) => (PAID_STATUSES as readonly string[]).includes(s);
export const isAwaitingPix = (s: string) => (AWAITING_PIX_STATUSES as readonly string[]).includes(s);
export const isCrediarioStatus = (s: string) => (CREDIARIO_STATUSES as readonly string[]).includes(s);

/** Transições manuais do crediário (feitas pelo admin após analisar o protocolo). */
export const CREDIARIO_TRANSITIONS: Record<CrediarioStatus, CrediarioStatus[]> = {
  CREDIARIO_PENDENTE: ["CREDIARIO_EM_ANALISE", "CREDIARIO_APROVADO", "CREDIARIO_RECUSADO", "CREDIARIO_CANCELADO"],
  CREDIARIO_EM_ANALISE: ["CREDIARIO_APROVADO", "CREDIARIO_RECUSADO", "CREDIARIO_CANCELADO", "CREDIARIO_PENDENTE"],
  CREDIARIO_APROVADO: ["CREDIARIO_CONCLUIDO", "CREDIARIO_CANCELADO"],
  CREDIARIO_RECUSADO: ["CREDIARIO_EM_ANALISE"],
  CREDIARIO_CANCELADO: [],
  CREDIARIO_CONCLUIDO: [],
};

// ───────────── Produto ─────────────

export type ProductSpec = { label: string; value: string };
export type IconItem = { icon?: string; title: string; text?: string };

export const ICONS = ["sparkle", "drop", "hand", "shield", "leaf", "clock", "truck", "lock", "chat", "pix", "check", "star", "box", "heart"] as const;
export type IconName = (typeof ICONS)[number];

// ───────────── Analytics ─────────────

export const TRACKED_EVENTS = [
  "page_view",
  "landing_view",
  "scroll_50",
  "scroll_90",
  "product_view",
  "offer_view",
  "offer_selected",
  "cta_click",
  "faq_open",
  "video_start",
  "video_complete",
  "checkout_started",
  "checkout_contact_completed",
  "order_bump_view",
  "order_bump_accept",
  "order_bump_reject",
  "payment_method_selected",
  "payment_started",
  "pix_generated",
  "pix_copied",
  "pix_renewed",
  "pix_error",
  "payment_pending",
  "payment_failed",
  "payment_expired",
  "order_created",
  "purchase",
  "crediario_started",
  "crediario_protocol_completed",
  "crediario_data_completed",
  "crediario_installment_selected",
  "crediario_order_created",
  "crediario_pending",
  "crediario_in_review",
  "crediario_approved",
  "crediario_rejected",
  "crediario_cancelled",
  "cookie_consent",
] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

/** Etapas do funil (cada etapa = sessões com pelo menos um dos eventos). */
export const FUNNEL_STEPS: { key: string; label: string; events: TrackedEvent[] }[] = [
  { key: "visitors", label: "Visitantes", events: ["page_view", "landing_view"] },
  { key: "product", label: "Produto visto", events: ["product_view"] },
  { key: "offer", label: "Oferta vista", events: ["offer_view", "offer_selected"] },
  { key: "cta", label: "CTA clicado", events: ["cta_click", "offer_selected"] },
  { key: "checkout", label: "Checkout", events: ["checkout_started"] },
  { key: "method", label: "PIX / Crediário", events: ["payment_method_selected", "crediario_started", "pix_generated"] },
  { key: "order", label: "Pedido criado", events: ["order_created"] },
  { key: "approved", label: "Pagamento / aprovação", events: ["purchase"] },
];

// ───────────── Landing page (CMS) ─────────────

export const SECTION_TYPES = {
  hero: "Primeira tela (hero)",
  pain: "Dor / identificação",
  solution: "Apresentação da solução",
  how_it_works: "Como funciona",
  demo: "Demonstração (vídeo / antes e depois)",
  benefits: "Benefícios",
  testimonials: "Depoimentos",
  offers: "Ofertas / kits",
  faq: "Perguntas frequentes",
  trust: "Confiança e segurança",
  final_cta: "CTA final",
} as const;
export type SectionType = keyof typeof SECTION_TYPES;
