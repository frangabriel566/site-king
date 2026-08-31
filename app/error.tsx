"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-8 text-center text-fg">
      <p className="text-label mb-6">Algo deu errado</p>
      <h1 className="text-display text-[clamp(3rem,14vw,10rem)]">
        Erro
        <br />
        inesperado
      </h1>
      <p className="mt-8 max-w-md text-sm text-ink-muted">
        Não foi possível carregar esta página. Tente novamente em
        instantes.
      </p>
      <button
        onClick={reset}
        className="mt-12 h-12 bg-white px-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition-opacity duration-200 ease-out hover:opacity-80"
      >
        Tentar novamente
      </button>
    </div>
  );
}
