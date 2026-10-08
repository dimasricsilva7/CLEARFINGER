import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { whatsappLink } from "@/components/layout/Footer";
import { TrackClient } from "./TrackClient";

export const metadata: Metadata = { title: "Rastrear pedido", robots: { index: false, follow: true } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const s = await getSettings();
  const { pedido } = await searchParams;
  const wa = s.whatsapp ? whatsappLink(s.whatsapp, "Olá! Preciso de ajuda com o rastreio do meu pedido.") : null;
  return (
    <section className="bg-mist/50">
      <div className="container-page max-w-2xl py-10 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Acompanhe sua entrega</p>
        <h1 className="h-section mt-2">Rastrear pedido</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">Informe o número do pedido e o CPF ou e-mail usado na compra.</p>
        <TrackClient initialOrder={(pedido ?? "").slice(0, 40)} support={{ whatsapp: wa, email: s.contact_email || null }} />
      </div>
    </section>
  );
}
