"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const CLOTHING_CHART = [
  { size: "P", chest: "88–96", waist: "72–80", length: "68" },
  { size: "M", chest: "96–104", waist: "80–88", length: "70" },
  { size: "G", chest: "104–112", waist: "88–96", length: "72" },
  { size: "GG", chest: "112–120", waist: "96–104", length: "74" },
];

// Approximate reference (BR size -> foot length in cm), same shape as the
// usual retail size-guide table — not a clinical measurement.
const SHOE_CHART = [
  { size: "34", length: "22,75" },
  { size: "35", length: "23,5" },
  { size: "36", length: "24" },
  { size: "37", length: "24,5" },
  { size: "38", length: "25,5" },
  { size: "39", length: "25,75" },
  { size: "40", length: "26,5" },
  { size: "41", length: "27" },
  { size: "42", length: "27,5" },
  { size: "43", length: "28" },
  { size: "44", length: "28,5" },
];

/** Numeric variant sizes (e.g. "40", "41") mean shoe sizing — show the
 * BR-size/foot-length chart instead of the clothing chest/waist chart. */
function isShoeSizing(sizes: string[]): boolean {
  return sizes.length > 0 && sizes.every((s) => /^\d{2,3}$/.test(s));
}

export function SizeGuideModal({ sizes = [] }: { sizes?: string[] }) {
  const [open, setOpen] = useState(false);
  const isShoe = isShoeSizing(sizes);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-fg underline underline-offset-4 hover:text-gold-text"
      >
        Tabela de medidas
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-line bg-white text-fg">
          <DialogTitle className="text-lg font-bold">Tabela de medidas</DialogTitle>
          {isShoe ? (
            <>
              <p className="text-xs text-muted-foreground">
                Medida do comprimento do pé, em centímetros. Em caso de dúvida
                entre dois números, prefira o maior.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Internacional</th>
                      <th className="py-2">Comprimento do pé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHOE_CHART.map((row) => (
                      <tr key={row.size} className="border-b border-line/50">
                        <td className="py-2 pr-4 font-medium">{row.size}</td>
                        <td className="py-2 text-muted-foreground">{row.length} cm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Medidas em centímetros. Corpo, não peça — em caso de dúvida entre
                dois tamanhos, prefira o maior.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Tamanho</th>
                      <th className="py-2 pr-4">Peito</th>
                      <th className="py-2 pr-4">Cintura</th>
                      <th className="py-2">Comprimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CLOTHING_CHART.map((row) => (
                      <tr key={row.size} className="border-b border-line/50">
                        <td className="py-2 pr-4 font-medium">{row.size}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{row.chest}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{row.waist}</td>
                        <td className="py-2 text-muted-foreground">{row.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
