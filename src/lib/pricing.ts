/** Regras de preço e totais — puras, usadas no servidor (fonte da verdade), na landing e nos testes. */

export function computeTotals(lines: { unitPriceCents: number; quantity: number }[], shippingCents: number, discountCents = 0) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discount = Math.min(discountCents, subtotalCents);
  const totalCents = Math.max(0, subtotalCents - discount + shippingCents);
  return { subtotalCents, discountCents: discount, shippingCents, totalCents };
}

/** Percentual de desconto real (preço antigo × preço atual). null se não houver desconto. */
export function discountPct(priceCents: number, compareAtCents: number | null | undefined): number | null {
  if (!compareAtCents || compareAtCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}

/** Texto de desconto da oferta: o personalizado do admin ou o calculado. */
export function offerDiscountLabel(o: { priceCents: number; compareAtPriceCents: number | null; discountLabel?: string | null }) {
  if (o.discountLabel?.trim()) return o.discountLabel.trim();
  const pct = discountPct(o.priceCents, o.compareAtPriceCents);
  return pct ? `-${pct}%` : null;
}

/** Número do pedido exibido ao cliente: CF27684-2026 (código aleatório de 5 dígitos + ano). */
export function formatOrderNumber(year: number, code: number) {
  return `CF${code}-${year}`;
}

/** BravoPay: valor mínimo de uma cobrança PIX. */
export const MIN_PIX_CENTS = 500;
