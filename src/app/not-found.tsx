import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Erro 404</p>
      <h1 className="h-section mt-2">Página não encontrada</h1>
      <p className="lead mt-3">O endereço pode ter mudado. Volte para a página inicial.</p>
      <Link href="/" className="btn-primary mt-8">Ir para o início</Link>
    </div>
  );
}
