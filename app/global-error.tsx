"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-8 text-center text-white">
        <p className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[#8a8a8a]">
          Algo deu errado
        </p>
        <h1 className="text-[clamp(3rem,14vw,10rem)] font-extrabold uppercase leading-[0.85] tracking-[-0.04em]">
          Erro
          <br />
          crítico
        </h1>
        <p className="mt-8 max-w-md text-sm text-[#8a8a8a]">
          A aplicação encontrou um erro grave. Tente recarregar a página.
        </p>
        <button
          onClick={reset}
          className="mt-12 h-12 bg-white px-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition-opacity duration-200 ease-out hover:opacity-80"
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
