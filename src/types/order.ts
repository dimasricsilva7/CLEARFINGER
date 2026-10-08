export type PublicOrder = {
  orderNumber: string;
  status: string;
  paymentMethod: "PIX" | "CREDIARIO";
  fulfillmentStatus: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  metaEventId: string | null;
  customerFirstName: string;
  trackingCode: string | null;
  pixError: boolean;
  crediario: { installments: number; installmentLabel: string; methodLabel: string } | null;
  items: { name: string; offerName: string; kind: "OFFER" | "ORDER_BUMP" | "UPSELL"; quantity: number; units: number; unitPriceCents: number; totalPriceCents: number }[];
  /** Preenchidos no servidor (página e polling): oferta pós-compra, linha do tempo e textos de entrega */
  upsell?: PublicUpsell | null;
  timeline?: PublicTrackingEvent[];
  etaText?: string;
  shippingLabel?: string;
};

export type PublicUpsell = {
  id: string;
  title: string;
  description: string | null;
  productName: string;
  quantity: number;
  priceCents: number;
  compareAtPriceCents: number | null;
  imageUrl: string | null;
  badge: string | null;
  acceptLabel: string;
  declineLabel: string;
  position: "TOP" | "BOTTOM";
};

/** Linha do tempo pública (rastreio e página do pedido): só dados não sensíveis. */
export type PublicTrackingEvent = { status: string; title: string; description: string | null; at: string; done: boolean };
