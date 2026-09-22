"use client";

import Image from "next/image";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VariantMode, VariantTotals } from "@/lib/variants";
import type { ProductStatus } from "@/lib/database.types";

type StatusAction = { label: string; status: ProductStatus };

/**
 * The two save buttons in the bar, per current situação. There's no
 * separate "rascunho" concept in the backend — products.status is the
 * whole story — so each button just says which status it saves with.
 */
function statusActions(status: ProductStatus): { primary: StatusAction; secondary: StatusAction } {
  if (status === "active") {
    return {
      primary: { label: "Salvar alterações", status: "active" },
      secondary: { label: "Voltar para rascunho", status: "draft" },
    };
  }
  if (status === "archived") {
    return {
      primary: { label: "Salvar alterações", status: "archived" },
      secondary: { label: "Publicar produto", status: "active" },
    };
  }
  return {
    primary: { label: "Publicar produto", status: "active" },
    secondary: { label: "Salvar rascunho", status: "draft" },
  };
}

export function ProductFormActionBar({
  productName,
  coverUrl,
  totals,
  mode,
  simpleStock,
  status,
  pending,
  onBeforeSubmit,
  onCancel,
  onDuplicate,
  duplicating,
}: {
  productName: string;
  coverUrl: string | null;
  totals: VariantTotals;
  /** Decides what the summary counts — see buildSummary below. */
  mode: VariantMode;
  simpleStock: number;
  status: ProductStatus;
  pending: boolean;
  /** Runs before the form submits, so the status the clicked button
   * stands for is already in the form when it goes out. */
  onBeforeSubmit: (status: ProductStatus) => void;
  onCancel: () => void;
  /** Edit mode only. */
  onDuplicate?: () => void;
  duplicating?: boolean;
}) {
  const { primary, secondary } = statusActions(status);

  const summary = buildSummary();

  /** Counts only what the current mode actually has: a one-colourway
   * product has no colour count to report. */
  function buildSummary(): string {
    if (mode === "single") return `Peça única · ${simpleStock} em estoque`;
    if (totals.variants === 0) return "Nenhuma variação ainda";

    const sizes = `${totals.sizes} ${totals.sizes === 1 ? "tamanho" : "tamanhos"}`;
    const variations = `${totals.variants} ${
      totals.variants === 1 ? "variação" : "variações"
    }`;
    if (mode === "sizes") return `${sizes} • ${variations}`;

    const colors = `${totals.colors} ${totals.colors === 1 ? "cor" : "cores"}`;
    return `${colors} • ${sizes} • ${variations}`;
  }

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-line bg-[var(--header-bg)]/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {coverUrl && (
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line bg-field">
              <Image src={coverUrl} alt="" fill sizes="44px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">
              Produto:{" "}
              <span className="font-medium">
                {productName.trim() || <span className="text-ink-muted">sem nome</span>}
              </span>
            </p>
            <p className="truncate text-xs text-ink-muted">{summary}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onCancel}
            className="order-5 sm:order-none"
          >
            Cancelar
          </Button>

          {onDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onDuplicate}
              disabled={duplicating}
              className="order-4 sm:order-none"
            >
              <Copy className="size-4" /> {duplicating ? "Duplicando…" : "Duplicar"}
            </Button>
          )}

          <Button
            type="submit"
            name="intent"
            value="save_and_new"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => onBeforeSubmit(status)}
            className="order-3 sm:order-none"
          >
            Salvar e criar outro
          </Button>

          <Button
            type="submit"
            name="intent"
            value="save"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => onBeforeSubmit(secondary.status)}
            className="order-2 sm:order-none"
          >
            {secondary.label}
          </Button>

          <Button
            type="submit"
            name="intent"
            value="save"
            size="lg"
            disabled={pending}
            onClick={() => onBeforeSubmit(primary.status)}
            className="order-first col-span-2 sm:order-none sm:col-span-1"
          >
            {pending ? "Salvando…" : primary.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
