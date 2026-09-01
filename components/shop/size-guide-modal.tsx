"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const SIZE_CHART = [
  { size: "P", chest: "88–96", waist: "72–80", length: "68" },
  { size: "M", chest: "96–104", waist: "80–88", length: "70" },
  { size: "G", chest: "104–112", waist: "88–96", length: "72" },
  { size: "GG", chest: "112–120", waist: "96–104", length: "74" },
];

export function SizeGuideModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-label underline underline-offset-4 hover:text-gold"
      >
        Guia de medidas
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-none border-line bg-[#111111] text-fg">
          <DialogTitle className="text-heading text-lg">
            Guia de medidas
          </DialogTitle>
          <p className="text-xs text-ink-muted">
            Medidas em centímetros. Corpo, não peça — em caso de dúvida entre
            dois tamanhos, prefira o maior.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-label">
                  <th className="py-2 pr-4">Tamanho</th>
                  <th className="py-2 pr-4">Peito</th>
                  <th className="py-2 pr-4">Cintura</th>
                  <th className="py-2">Comprimento</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.map((row) => (
                  <tr key={row.size} className="border-b border-line/50">
                    <td className="py-2 pr-4 font-medium">{row.size}</td>
                    <td className="py-2 pr-4 text-ink-muted">{row.chest}</td>
                    <td className="py-2 pr-4 text-ink-muted">{row.waist}</td>
                    <td className="py-2 text-ink-muted">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
