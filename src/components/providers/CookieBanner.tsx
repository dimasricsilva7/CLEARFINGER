"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getConsent, setConsent, track } from "@/lib/client/tracking";

/**
 * Aviso de cookies (LGPD, modelo de recusa): medição e marketing ficam ativos por padrão;
 * o visitante pode aceitar, recusar ou configurar aqui, ou depois pelo link do rodapé.
 * Não aparece no checkout nem na página do pedido para não atrapalhar o pagamento.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [config, setConfig] = useState(false);
  const [marketing, setMarketing] = useState(true);
  const pathname = usePathname();
  useEffect(() => {
    setShow(getConsent() === null);
    setMarketing(getConsent() !== "denied");
    const open = () => {
      setShow(true);
      setConfig(true);
    };
    window.addEventListener("cf:open-consent", open);
    return () => window.removeEventListener("cf:open-consent", open);
  }, []);
  if (!show || pathname.startsWith("/checkout") || pathname.startsWith("/pedido")) return null;
  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    track("cookie_consent", { props: { choice: v } });
    setShow(false);
    setConfig(false);
  };
  return (
    <div className="fixed inset-x-2 bottom-2 z-[70] mx-auto max-w-xl rounded-2xl border border-line bg-surface p-3 shadow-lift sm:bottom-5 sm:p-4" role="dialog" aria-label="Preferências de cookies">
      <p className="text-[13px] leading-snug text-ink sm:text-sm">
        Usamos cookies para o site funcionar e para medir nossos anúncios.{" "}
        <Link href="/cookies" className="font-semibold text-primary underline">
          Saiba mais
        </Link>
      </p>
      {config && (
        <div className="mt-3 space-y-2 rounded-xl bg-mist/60 p-3 text-[13px]">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4" />
            <span><b>Essenciais</b> — sessão, segurança e funcionamento do pedido (sempre ativos).</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span><b>Medição e marketing</b> — Meta Pixel e Google, para medir e melhorar anúncios.</span>
          </label>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {config ? (
          <button onClick={() => choose(marketing ? "granted" : "denied")} className="min-h-[38px] flex-1 rounded-xl bg-navy px-4 text-sm font-bold text-white">
            Salvar preferências
          </button>
        ) : (
          <>
            <button onClick={() => choose("granted")} className="min-h-[38px] flex-1 rounded-xl bg-navy px-4 text-sm font-bold text-white">
              Aceitar
            </button>
            <button onClick={() => choose("denied")} className="min-h-[38px] flex-1 rounded-xl border border-line px-4 text-sm font-bold text-navy">
              Recusar
            </button>
            <button onClick={() => setConfig(true)} className="min-h-[38px] px-2 text-sm font-semibold text-muted underline">
              Configurar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Link do rodapé para rever a escolha. */
export function CookiePreferencesLink({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("cf:open-consent"))} className={className}>
      Preferências de cookies
    </button>
  );
}
