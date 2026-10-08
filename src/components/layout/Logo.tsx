/* eslint-disable @next/next/no-img-element */
/** Logo vindo das Configurações (upload, /brand ou URL externa). Sem logo → nome em texto. */
export function Logo({ url, name, className = "h-8 w-auto" }: { url: string | null; name: string; className?: string }) {
  if (url) return <img src={url} alt={name} className={className} width={720} height={189} decoding="async" />;
  return (
    <span className="font-display text-xl font-bold tracking-tight text-navy">
      {name.slice(0, 5)}
      <span className="text-primary">{name.slice(5)}</span>
    </span>
  );
}
