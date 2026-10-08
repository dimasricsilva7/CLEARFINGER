import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/Icon";
import { getSettings } from "@/server/settings";

/** Layout enxuto do checkout e da página do pedido (sem menu, sem distrações). */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" aria-label={`${s.store_name} — início`}>
            <Logo url={s.logo_url || null} name={s.store_name} className="h-6 w-auto sm:h-7" />
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Icon name="lock" className="h-4 w-4 text-success" strokeWidth={2} /> Ambiente seguro
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
