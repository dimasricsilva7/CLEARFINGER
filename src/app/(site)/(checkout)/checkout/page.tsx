import type { Metadata } from "next";
import Link from "next/link";
import { crediarioConfig } from "@/lib/crediario";
import { bravopayMode } from "@/lib/env";
import { getActiveBumps, getMainProduct } from "@/server/catalog";
import { getSettings, isOn, shippingCentsFrom } from "@/server/settings";
import { CheckoutClient } from "./CheckoutClient";
import { findLeadByToken } from "@/server/checkout-leads";

export const metadata: Metadata = { title: "Finalizar pedido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ oferta?: string; recuperar?: string }> }) {
  const [{ oferta, recuperar }, product, s, bumps] = await Promise.all([searchParams, getMainProduct(), getSettings(), getActiveBumps().catch(() => [])]);
  if (!product?.offers.length) {
    return (
      <div className="container-page max-w-lg py-20 text-center">
        <h1 className="h-section">Produto indisponível no momento</h1>
        <Link href="/" className="btn-primary mt-8">Voltar</Link>
      </div>
    );
  }
  // Link do e-mail de checkout abandonado: restaura kit, adicionais e contato
  const lead = recuperar ? await findLeadByToken(recuperar).catch(() => null) : null;
  const initial = (lead?.offerId ? product.offers.find((o) => o.id === lead.offerId) : undefined) ?? product.offers.find((o) => o.slug === oferta || o.id === oferta) ?? product.offers.find((o) => o.highlight) ?? product.offers[0];
  const cfg = crediarioConfig(s);
  return (
    <CheckoutClient
      productId={product.id}
      productName={product.shortName || product.name}
      sku={product.sku}
      imageUrl={product.mainImage?.url ?? null}
      volume={product.specs.find((x) => /conte|volume/i.test(x.label))?.value ?? null}
      offers={product.offers}
      bumps={bumps}
      initialOfferId={initial.id}
      shippingCents={shippingCentsFrom(s)}
      shippingLabel={isOn(s.shipping_free_enabled) ? s.shipping_label : ""}
      shippingEta={s.shipping_eta}
      bumpTitle={s.bump_section_title || "Adicione também ao seu pedido"}
      bumpText={s.bump_section_text}
      shippingNote={s.shipping_note}
      requireCpf={isOn(s.require_cpf)}
      consentLabel={s.marketing_consent_label}
      title={s.checkout_title || "Finalizar pedido"}
      securityText={s.checkout_security_text}
      pix={{ enabled: isOn(s.pix_enabled) && bravopayMode() !== "disabled", label: s.pix_method_label || "PIX", badge: s.pix_badge ?? "", description: s.pix_description, button: s.pix_button_label || "Gerar PIX" }}
      crediario={cfg}
      recovered={lead && !lead.orderId ? { clientKey: lead.clientKey, name: lead.name, email: lead.email, phone: lead.phone, bumpIds: Array.isArray(lead.bumpIds) ? (lead.bumpIds as string[]) : [] } : null}
    />
  );
}
