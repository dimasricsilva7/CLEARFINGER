/* eslint-disable @next/next/no-img-element */

/**
 * Foto oficial do produto (opaca, fundo branco). Em kits, a MESMA foto é repetida lado a lado,
 * na mesma escala e alinhada pela base: 1 unidade = 1 produto, 2 = 2 produtos, 3 = 3 produtos.
 */
export function ProductStack({ src, alt, count = 1, className = "", priority = false }: { src: string; alt: string; count?: number; className?: string; priority?: boolean }) {
  const n = Math.max(1, Math.min(3, count));
  const positioned = /(^|\s)(absolute|fixed)(\s|$)/.test(className);
  return (
    <div className={`${positioned ? "" : "relative"} flex items-end justify-center gap-[2%] ${className}`} role="img" aria-label={n > 1 ? `${alt} — ${count} unidades` : alt}>
      {Array.from({ length: n }, (_, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden="true"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority && i === 0 ? "high" : undefined}
          decoding="async"
          width={992}
          height={1100}
          className="h-full min-w-0 object-contain object-bottom"
          style={{ width: `${100 / n - (n > 1 ? 1.5 : 0)}%` }}
        />
      ))}
    </div>
  );
}

/** Painel branco limpo atrás do produto (a foto tem fundo branco e se funde a ele). */
export function Stage({ children, className = "", tone = "light" }: { children: React.ReactNode; className?: string; tone?: "light" | "onDark" }) {
  return <div className={`relative overflow-hidden rounded-[1.75rem] bg-white ${tone === "onDark" ? "shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]" : "shadow-soft ring-1 ring-line/70"} ${className}`}>{children}</div>;
}
