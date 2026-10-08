import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { whatsappLink } from "@/components/layout/Footer";
import { formatPhone } from "@/utils/format";

export const metadata: Metadata = { title: "Contato" };

/** Contato e identificação da empresa — somente dados preenchidos em Configurações → Empresa. */
export default async function ContactPage() {
  const s = await getSettings();
  const wa = s.whatsapp ? whatsappLink(s.whatsapp, `Olá! Tenho uma dúvida sobre o ${s.store_name}.`) : null;
  const rows = [
    s.company_name && { label: "Razão social", value: s.company_name },
    s.company_document && { label: "CNPJ", value: s.company_document },
    s.address && { label: "Endereço", value: s.address },
  ].filter(Boolean) as { label: string; value: string }[];
  return (
    <section className="bg-mist/50">
      <div className="container-page max-w-2xl py-10 sm:py-16">
        <h1 className="h-section">Contato</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">Fale com a nossa equipe pelos canais abaixo.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="card block p-5 transition hover:border-primary/40">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">WhatsApp</p>
              <p className="mt-1 font-display text-lg font-semibold text-navy">{formatPhone(s.whatsapp)}</p>
            </a>
          )}
          {s.contact_email && (
            <a href={`mailto:${s.contact_email}`} className="card block p-5 transition hover:border-primary/40">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">E-mail</p>
              <p className="mt-1 break-all font-display text-lg font-semibold text-navy">{s.contact_email}</p>
            </a>
          )}
        </div>
        {s.support_hours && <p className="mt-3 text-sm text-muted">Atendimento: {s.support_hours}</p>}
        <p className="mt-6 text-sm text-muted">
          Já comprou? <Link href="/rastrear-pedido" className="font-semibold text-primary hover:underline">Rastreie seu pedido</Link>.
        </p>
        {rows.length > 0 && (
          <dl className="card mt-8 divide-y divide-line text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:justify-between">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-semibold text-navy">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
