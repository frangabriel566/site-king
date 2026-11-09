"use client";

import { useState } from "react";
import type { TicketBlock } from "@/lib/orders/ticket";

const IS_MOBILE = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Imprime um PDF da notinha, e não a página: o navegador só escreve data,
 * título, endereço e "1/1" quando imprime página de site. Num PDF não há
 * cabeçalho nem rodapé, e o papel tem o tamanho exato da nota.
 */
export function PrintButton({
  blocks,
  title,
}: {
  blocks: TicketBlock[];
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function print() {
    setBusy(true);
    setFailed(false);
    // Celular não imprime PDF escondido: abre o PDF numa aba. A aba precisa
    // nascer aqui, ainda dentro do clique, ou o navegador a bloqueia.
    const tab = IS_MOBILE() ? window.open("", "_blank") : null;
    try {
      const { buildTicketPdf } = await import("@/lib/orders/ticket-pdf");
      const bytes = await buildTicketPdf(blocks, title);
      const url = URL.createObjectURL(
        new Blob([bytes.slice().buffer], { type: "application/pdf" }),
      );
      if (tab) {
        tab.location.href = url;
        return;
      }
      document.getElementById("notinha-pdf")?.remove();
      const frame = document.createElement("iframe");
      frame.id = "notinha-pdf";
      frame.title = title;
      frame.style.cssText =
        "position:fixed;left:-9999px;top:0;width:320px;height:320px;border:0";
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, "_blank");
        }
      };
      frame.src = url;
      document.body.appendChild(frame);
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={print}
        disabled={busy}
        className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Preparando…" : "Imprimir"}
      </button>
      {failed && (
        <p className="mt-2 text-sm">
          Não foi possível gerar a nota. Tente de novo.
        </p>
      )}
    </div>
  );
}
