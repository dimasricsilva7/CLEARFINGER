import type { EmailOrder } from "./templates";

/** Pedido fictício para prévia e e-mail de teste no admin. */
export function sampleOrder(): EmailOrder {
  return {
    orderNumber: "CF12345-2026",
    firstName: "Maria",
    paymentLabel: "PIX",
    items: [
      { name: "CLEARFINGER", detail: "2 unidades", quantity: 1, totalCents: 5990, kind: "OFFER" },
      { name: "Adicione +1 frasco com desconto", detail: "Adicionado ao pedido", quantity: 1, totalCents: 3990, kind: "ORDER_BUMP" },
    ],
    subtotalCents: 9980,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 9980,
    pixCopyPaste: "00020126580014br.gov.bcb.pix0136exemplo-de-codigo-pix-para-previa520400005303986540599.805802BR5911CLEARFINGER6009SAO PAULO62070503***6304ABCD",
    pixExpiresAt: new Date(Date.now() + 25 * 60_000),
    pixExpired: false,
    address: "Avenida Paulista, 1000 · Bela Vista · São Paulo/SP · CEP 01310-100",
  };
}
