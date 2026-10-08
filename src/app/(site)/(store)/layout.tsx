import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSettings } from "@/server/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <Header name={s.store_name} logoUrl={s.logo_url || null} ctaLabel={s.header_cta_label || "Comprar"} announcement={s.announcement_text || null} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <Footer s={s} />
    </div>
  );
}
