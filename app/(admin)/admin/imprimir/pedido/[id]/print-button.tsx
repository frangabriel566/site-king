"use client";

/** Abre a janela de impressão do navegador (ou "Salvar como PDF"). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white"
    >
      Imprimir
    </button>
  );
}
