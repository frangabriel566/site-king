"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Share2, ChevronDown } from "lucide-react";
import type { ProductWithRelations } from "@/lib/data/products";

const VISIBLE_ROWS = 4;

export function ProductSpecs({ product }: { product: ProductWithRelations }) {
  const [expanded, setExpanded] = useState(false);

  const attributes =
    product.attributes && typeof product.attributes === "object"
      ? (product.attributes as Record<string, string>)
      : {};

  const rows: { label: string; value: string }[] = [];
  if (product.brand) rows.push({ label: "Marca", value: product.brand.name });
  if (product.collection) rows.push({ label: "Coleção", value: product.collection });
  if (product.manufacturer_ref) {
    rows.push({ label: "Referência", value: product.manufacturer_ref });
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (value) rows.push({ label: key, value });
  }

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard unavailable — nothing more we can do here
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {product.brand?.logo_url && (
        <Link href={`/marca/${product.brand.slug}`} className="block w-fit">
          <Image
            src={product.brand.logo_url}
            alt={product.brand.name}
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
          />
        </Link>
      )}

      {rows.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ficha técnica
          </p>
          <dl className="flex flex-col gap-2">
            {visibleRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 border-b border-line py-1.5 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>
          {rows.length > VISIBLE_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 flex items-center gap-1 text-sm font-medium text-gold-text hover:underline"
            >
              {expanded ? "Ver menos" : "Ver mais"}
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      )}

      {product.care_instructions && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cuidados com a peça
          </p>
          <p className="text-sm text-fg">{product.care_instructions}</p>
        </div>
      )}

      {product.tags && product.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleShare}
        className="flex w-fit items-center gap-2 text-sm font-medium text-fg hover:text-gold-text"
      >
        <Share2 className="size-4" aria-hidden="true" />
        Compartilhar
      </button>
    </div>
  );
}
