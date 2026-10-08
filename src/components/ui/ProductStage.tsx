/* eslint-disable @next/next/no-img-element */

/**
 * Produto num "palco" claro (o recorte sem fundo se integra à paleta). Para kits, mostra
 * a quantidade real de unidades lado a lado, com leve sobreposição — o cliente vê o que está levando.
 */
export function ProductStack({ src, alt, count = 1, className = "", priority = false }: { src: string; alt: string; count?: number; className?: string; priority?: boolean }) {
  const n = Math.max(1, Math.min(3, count));
  // largura de cada unidade (em % da caixa) e passo entre elas — cabem lado a lado com ~25% de sobreposição
  const unit = n === 1 ? 100 : n === 2 ? 62 : 46;
  const step = n === 1 ? 0 : (100 - unit) / (n - 1);
  const positioned = /(^|\s)(absolute|fixed)(\s|$)/.test(className);
  return (
    <div className={`${positioned ? "" : "relative"} ${className}`} role="img" aria-label={n > 1 ? `${alt} — ${count} unidades` : alt}>
      {Array.from({ length: n }, (_, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden="true"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority && i === n - 1 ? "high" : undefined}
          decoding="async"
          width={915}
          height={1139}
          className="absolute bottom-0 h-full object-contain object-bottom drop-shadow-[0_16px_20px_rgba(11,37,69,0.16)]"
          style={{ left: `${i * step}%`, width: `${unit}%`, zIndex: i, filter: i < n - 1 ? "brightness(0.97)" : undefined }}
        />
      ))}
    </div>
  );
}

/** Palco: círculo de luz suave em tons da marca, atrás do produto. */
export function Stage({ children, className = "", tone = "light" }: { children: React.ReactNode; className?: string; tone?: "light" | "onDark" }) {
  return (
    <div className={`relative isolate ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-x-[4%] bottom-[2%] top-[6%] -z-10 rounded-full ${tone === "onDark" ? "bg-[radial-gradient(closest-side,#ffffff_0%,#eaf2fb_58%,rgba(234,242,251,0)_100%)]" : "bg-[radial-gradient(closest-side,#ffffff_0%,#e3ecf7_62%,rgba(227,236,247,0)_100%)]"}`}
      />
      <div aria-hidden="true" className="absolute bottom-[4%] left-1/2 -z-10 h-[5%] w-[56%] -translate-x-1/2 rounded-[100%] bg-navy/15 blur-xl" />
      {children}
    </div>
  );
}
