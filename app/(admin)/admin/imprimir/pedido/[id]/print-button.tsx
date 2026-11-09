"use client";

import { useEffect, useState } from "react";

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

const MM_PER_CSS_PX = 25.4 / 96;

/**
 * Faz a "página" ter exatamente a altura da notinha, para a bobina não sair
 * com papel em branco: o CSS não aceita altura automática em @page, então
 * mede o conteúdo. Margem 0 também tira a data e o endereço que o navegador
 * imprime no topo e no rodapé.
 */
export function ThermalPageSize({ ticketId }: { ticketId: string }) {
  const [heightMm, setHeightMm] = useState(200);

  useEffect(() => {
    const ticket = document.getElementById(ticketId);
    if (!ticket) return;
    const measure = () =>
      setHeightMm(Math.ceil(ticket.getBoundingClientRect().height * MM_PER_CSS_PX) + 1);
    measure();
    void document.fonts.ready.then(measure);
  }, [ticketId]);

  return (
    <style>{`@page { size: 80mm ${heightMm}mm; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
  );
}
