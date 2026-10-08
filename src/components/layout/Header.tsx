import Link from "next/link";
import { Logo } from "./Logo";

export function Header({ name, logoUrl, ctaLabel, announcement }: { name: string; logoUrl: string | null; ctaLabel: string; announcement: string | null }) {
  return (
    <>
      {announcement && <p className="bg-navy px-4 py-2 text-center text-[13px] font-medium text-white">{announcement}</p>}
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${name} — início`} className="shrink-0">
            <Logo url={logoUrl} name={name} className="h-7 w-auto sm:h-8" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex" aria-label="Principal">
            <Link href="/#como-funciona" className="hover:text-navy">Como usar</Link>
            <Link href="/#ofertas" className="hover:text-navy">Kits e preços</Link>
            <Link href="/#faq" className="hover:text-navy">Dúvidas</Link>
            <Link href="/rastrear-pedido" className="hover:text-navy">Rastrear pedido</Link>
          </nav>
          <div className="flex items-center gap-1">
          <Link href="/rastrear-pedido" className="inline-flex min-h-[40px] items-center px-2 text-[13px] font-semibold text-muted hover:text-navy md:hidden">Rastrear</Link>
          <Link href="/#ofertas" data-cta="header_cta" className="inline-flex min-h-[40px] items-center rounded-lg bg-navy px-4 text-sm font-bold text-white hover:bg-navy/90">
            {ctaLabel}
          </Link>
          </div>
        </div>
      </header>
    </>
  );
}
