import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { crediarioConfig } from "@/lib/crediario";
import { findOrderByAccess, toPublicOrder, withOrderExtras } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { getMainProduct } from "@/server/catalog";
import { whatsappLink } from "@/components/layout/Footer";
import { OrderClient } from "./OrderClient";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<{ t?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ numero }, { t }] = await Promise.all([params, searchParams]);
  const order = await findOrderByAccess(decodeURIComponent(numero), t);
  if (!order) {
    return (
      <div className="container-page max-w-lg py-20 text-center">
        <h1 className="h-section">Pedido não encontrado</h1>
        <p className="lead mt-3">Confira o link recebido ou fale com o atendimento.</p>
        <Link href="/" className="btn-primary mt-8">Voltar ao início</Link>
      </div>
    );
  }
  const [s, product] = await Promise.all([getSettings(), getMainProduct()]);
  const pub = await withOrderExtras(order, toPublicOrder(order));
  // Imagem do kit comprado: a imagem própria do kit (uma vez) ou a foto do produto repetida pela quantidade
  const mainItem = order.items.find((i) => i.kind === "OFFER") ?? order.items[0];
  const offerImage = mainItem?.offerId ? (await db.productOffer.findUnique({ where: { id: mainItem.offerId }, select: { imageUrl: true } }))?.imageUrl ?? null : null;
  const qrSvg = pub.pixCopyPaste ? await QRCode.toString(pub.pixCopyPaste, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B2545", light: "#FFFFFF" } }) : null;
  const wa = s.whatsapp ? whatsappLink(s.whatsapp, `Olá! Tenho uma dúvida sobre o pedido ${pub.orderNumber}.`) : null;
  const cfg = crediarioConfig(s);

  return <OrderClient initial={pub} token={t!} qrSvg={qrSvg} whatsappUrl={wa} storeName={s.store_name} crediarioTexts={{ successTitle: cfg.successTitle, successMessage: cfg.successMessage, infoMessage: cfg.infoMessage }} imageUrl={offerImage ?? product?.mainImage?.url ?? null} imageIsKit={Boolean(offerImage)} />;
}
