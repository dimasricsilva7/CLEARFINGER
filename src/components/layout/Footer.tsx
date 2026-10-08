import Link from "next/link";
import { CookiePreferencesLink } from "@/components/providers/CookieBanner";
import { formatPhone } from "@/utils/format";
import { Logo } from "./Logo";

export function whatsappLink(raw: string, text?: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  const n = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Rodapé: só exibe contatos e dados da empresa realmente preenchidos em Configurações. */
export function Footer({ s }: { s: Record<string, string> }) {
  const wa = s.whatsapp ? whatsappLink(s.whatsapp, `Olá! Tenho uma dúvida sobre o ${s.store_name}.`) : null;
  const contacts = [
    wa && { label: `WhatsApp ${formatPhone(s.whatsapp)}`, href: wa },
    s.contact_email && { label: s.contact_email, href: `mailto:${s.contact_email}` },
    s.contact_phone && { label: formatPhone(s.contact_phone), href: `tel:${s.contact_phone.replace(/\D/g, "")}` },
  ].filter(Boolean) as { label: string; href: string }[];
  const social = (
    [
      ["Instagram", s.instagram_url],
      ["Facebook", s.facebook_url],
      ["TikTok", s.tiktok_url],
      ["YouTube", s.youtube_url],
    ] as [string, string][]
  ).filter(([, u]) => u);
  const company = [s.company_name, s.company_document && `CNPJ ${s.company_document}`, s.address].filter(Boolean);
  const methods = [s.pix_enabled === "true" && (s.pix_method_label || "PIX"), s.crediario_enabled === "true" && (s.crediario_method_label || "Crediário")].filter(Boolean);

  return (
    <footer className="border-t border-line bg-surface pb-28 pt-12 md:pb-10">
      <div className="container-page grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo url={s.logo_url || null} name={s.store_name} className="h-8 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-muted">{s.store_tagline}</p>
          {s.footer_text && <p className="mt-3 max-w-sm text-sm text-muted">{s.footer_text}</p>}
          {methods.length > 0 && (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Formas de pagamento</p>
              <p className="mt-1 text-sm font-semibold text-navy">{methods.join(" · ")}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-navy">Atendimento</p>
          {contacts.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.href}>
                  <a href={c.href} className="break-all text-muted hover:text-navy" target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {c.label}
                  </a>
                </li>
              ))}
              {s.support_hours && <li className="text-muted">{s.support_hours}</li>}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Os canais de atendimento serão informados aqui.</p>
          )}
          {social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-3 text-sm">
              {social.map(([l, u]) => (
                <li key={l}>
                  <a href={u} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-navy">Institucional</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/politica-de-privacidade" className="hover:text-navy">Política de privacidade</Link></li>
            <li><Link href="/termos" className="hover:text-navy">Termos de uso</Link></li>
            <li><Link href="/trocas-e-devolucoes" className="hover:text-navy">Trocas e devoluções</Link></li>
            <li><Link href="/cookies" className="hover:text-navy">Política de cookies</Link></li>
            <li><CookiePreferencesLink className="hover:text-navy" /></li>
          </ul>
        </div>
      </div>
      <div className="container-page mt-10 border-t border-line pt-6 text-xs text-muted">
        {company.length > 0 && <p>{company.join(" · ")}</p>}
        <p className="mt-1">© {new Date().getFullYear()} {s.store_name}. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
