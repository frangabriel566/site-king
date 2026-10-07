"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SizeGuide } from "@/lib/size-guide";

/**
 * "Guia de medidas" — the product's category chart, exactly as the store
 * typed it in Admin → Categorias. There is no built-in chart: a table of
 * measurements the store never confirmed would be invented data, so a
 * category without one simply shows no link (see BuyBox).
 *
 * The row whose first cell is the size already picked is highlighted,
 * which answers "is my size the right one?" without reading the whole
 * table.
 */
export function SizeGuideModal({
  guide,
  selectedSize,
}: {
  guide: SizeGuide;
  selectedSize?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const selected = selectedSize?.trim().toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 44px tall hit area around a text link — it sits right next to the
        // size keys and gets reached for with the same thumb.
        className="-my-2 flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg underline underline-offset-4 hover:text-gold-text"
      >
        <Ruler className="size-4" aria-hidden="true" />
        Guia de medidas
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto border-line bg-white text-fg">
          <DialogTitle className="text-lg font-bold">Guia de medidas</DialogTitle>
          {guide.note ? (
            <DialogDescription className="text-sm text-muted-foreground">{guide.note}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Tabela de medidas por tamanho</DialogDescription>
          )}
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {guide.columns.map((column, i) => (
                    <th key={i} scope="col" className="whitespace-nowrap py-2 pr-4 last:pr-0">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guide.rows.map((row, r) => {
                  const isSelected = Boolean(selected) && row[0]?.trim().toLowerCase() === selected;
                  return (
                    <tr
                      key={r}
                      aria-current={isSelected || undefined}
                      className={`border-b border-line/60 ${isSelected ? "bg-surface font-semibold" : ""}`}
                    >
                      {row.map((cell, c) =>
                        c === 0 ? (
                          <th key={c} scope="row" className="py-2.5 pr-4 font-semibold">
                            {cell}
                          </th>
                        ) : (
                          <td key={c} className="py-2.5 pr-4 last:pr-0">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
