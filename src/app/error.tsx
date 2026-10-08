"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-20 text-center">
      <h1 className="h-section">Algo não carregou</h1>
      <p className="lead mt-3">Tente de novo em alguns segundos.</p>
      <button onClick={reset} className="btn-primary mt-8">Tentar novamente</button>
    </div>
  );
}
