import type { OrderStatusKey } from "./domain";

/**
 * Transições permitidas por eventos de PAGAMENTO PIX (webhook, polling, reconciliação).
 * Um pedido pago nunca volta a pendente/expirado; pagamento tardio de PIX expirado é aceito.
 * Pedidos do crediário nunca são alterados por eventos do gateway.
 */
export function canTransition(from: OrderStatusKey, to: OrderStatusKey): boolean {
  if (from === to || from.startsWith("CREDIARIO_")) return false;
  const awaiting = from === "PENDING" || from === "PIX_GENERATED";
  if (to === "PAID") return awaiting || from === "EXPIRED" || from === "FAILED" || from === "CANCELLED";
  if (to === "EXPIRED" || to === "FAILED") return awaiting;
  if (to === "REFUNDED") return from === "PAID";
  if (to === "CHARGEBACK") return from === "PAID" || from === "REFUNDED";
  return false;
}
