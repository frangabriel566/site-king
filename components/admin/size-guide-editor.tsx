"use client";

import { useState } from "react";
import { ClipboardPaste, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SIZE_GUIDE_CELL_MAX,
  SIZE_GUIDE_MAX_COLUMNS,
  SIZE_GUIDE_MAX_ROWS,
  SIZE_GUIDE_NOTE_MAX,
  normalizeSizeGuide,
  parseSizeGuidePaste,
  type SizeGuide,
} from "@/lib/size-guide";

type Draft = { columns: string[]; rows: string[][]; note: string };

/** Column titles to start from — only titles, never measurements: the
 * numbers are the store's to type. */
const STARTER_COLUMNS = ["Tamanho", "Peito (cm)", "Cintura (cm)", "Comprimento (cm)"];

function toDraft(guide: SizeGuide | null | undefined): Draft | null {
  if (!guide) return null;
  return { columns: [...guide.columns], rows: guide.rows.map((row) => [...row]), note: guide.note ?? "" };
}

/**
 * The category's size chart, edited as a small spreadsheet. Submitted as
 * JSON in a hidden `size_guide` field; the server normalizes it the same
 * way (lib/size-guide.ts), so blank rows and columns are never stored and
 * an all-blank table means "no guide" — the product page then shows no
 * link for it.
 */
export function SizeGuideEditor({ initial }: { initial: SizeGuide | null | undefined }) {
  const [draft, setDraft] = useState<Draft | null>(() => toDraft(initial));
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const value = draft ? normalizeSizeGuide(draft) : null;

  function update(fn: (d: Draft) => Draft) {
    setDraft((d) => (d ? fn(d) : d));
  }

  function applyPaste() {
    const parsed = parseSizeGuidePaste(pasteText);
    if (!parsed) return;
    setDraft({ columns: parsed.columns, rows: parsed.rows, note: draft?.note ?? "" });
    setPasting(false);
    setPasteText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="size_guide" value={value ? JSON.stringify(value) : ""} />
      <div>
        <p className="text-label mb-1">Guia de medidas</p>
        <p className="text-xs text-ink-muted">
          Aparece como &quot;Guia de medidas&quot; na página de cada produto desta categoria.
          Sem tabela, o link não aparece.
        </p>
      </div>

      {!draft ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ columns: [...STARTER_COLUMNS], rows: [STARTER_COLUMNS.map(() => "")], note: "" })}
          >
            <Plus className="size-4" aria-hidden="true" /> Criar tabela
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPasting(true)}>
            <ClipboardPaste className="size-4" aria-hidden="true" /> Colar de uma planilha
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {draft.columns.map((column, c) => (
                    <th key={c} className="min-w-28 border-b border-line p-1.5 text-left align-top">
                      <div className="flex items-center gap-1">
                        <Input
                          aria-label={`Título da coluna ${c + 1}`}
                          value={column}
                          maxLength={SIZE_GUIDE_CELL_MAX}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              columns: d.columns.map((v, i) => (i === c ? e.target.value : v)),
                            }))
                          }
                          className="h-9 font-semibold"
                        />
                        {draft.columns.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remover a coluna ${column || c + 1}`}
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                columns: d.columns.filter((_, i) => i !== c),
                                rows: d.rows.map((row) => row.filter((_, i) => i !== c)),
                              }))
                            }
                            className="flex size-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-fg"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10 border-b border-line" />
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, r) => (
                  <tr key={r}>
                    {draft.columns.map((column, c) => (
                      <td key={c} className="p-1.5">
                        <Input
                          aria-label={`${column || `Coluna ${c + 1}`}, linha ${r + 1}`}
                          value={row[c] ?? ""}
                          maxLength={SIZE_GUIDE_CELL_MAX}
                          onChange={(e) =>
                            update((d) => ({
                              ...d,
                              rows: d.rows.map((cells, i) =>
                                i === r ? d.columns.map((_, j) => (j === c ? e.target.value : (cells[j] ?? ""))) : cells,
                              ),
                            }))
                          }
                          className="h-9"
                        />
                      </td>
                    ))}
                    <td className="p-1.5">
                      <button
                        type="button"
                        aria-label={`Remover a linha ${r + 1}`}
                        onClick={() => update((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== r) }))}
                        className="flex size-8 items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-fg"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.rows.length >= SIZE_GUIDE_MAX_ROWS}
              onClick={() => update((d) => ({ ...d, rows: [...d.rows, d.columns.map(() => "")] }))}
            >
              <Plus className="size-4" aria-hidden="true" /> Linha
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.columns.length >= SIZE_GUIDE_MAX_COLUMNS}
              onClick={() =>
                update((d) => ({ ...d, columns: [...d.columns, ""], rows: d.rows.map((row) => [...row, ""]) }))
              }
            >
              <Plus className="size-4" aria-hidden="true" /> Coluna
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPasting(true)}>
              <ClipboardPaste className="size-4" aria-hidden="true" /> Colar de uma planilha
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <Trash2 className="size-4" aria-hidden="true" /> Remover tabela
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="size_guide_note">Observação (opcional)</Label>
            <Input
              id="size_guide_note"
              value={draft.note}
              maxLength={SIZE_GUIDE_NOTE_MAX}
              placeholder="ex.: Medidas do corpo, em centímetros. Na dúvida entre dois, prefira o maior."
              onChange={(e) => update((d) => ({ ...d, note: e.target.value }))}
            />
          </div>
          {!value && (
            <p className="text-xs font-medium text-warning">
              Tabela vazia: preencha pelo menos uma linha, ou ela não será salva.
            </p>
          )}
        </>
      )}

      {pasting && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <Label htmlFor="size_guide_paste">Cole as linhas da planilha (a primeira é o título)</Label>
          <Textarea
            id="size_guide_paste"
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Tamanho\tPeito (cm)\tCintura (cm)\nP\t88–96\t72–80"}
          />
          <p className="text-xs text-ink-muted">
            Copie as células no Excel ou no Google Planilhas e cole aqui. Também vale
            separar as colunas com ponto e vírgula.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={applyPaste} disabled={!parseSizeGuidePaste(pasteText)}>
              Usar estas linhas
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPasting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
