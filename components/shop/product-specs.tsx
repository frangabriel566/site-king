"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Share2, ChevronDown, Star, Mail } from "lucide-react";
import { WhatsAppIcon } from "./whatsapp-icon";
import { FacebookIcon } from "./facebook-icon";
import type { ProductWithRelations } from "@/lib/data/products";

const VISIBLE_ROWS = 4;

/** Opens a share window without pulling in any network's SDK — each one
 * takes the product URL as a plain query string. */
const SHARE_TARGETS = [
  {
    label: "Facebook",
    icon: FacebookIcon,
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  },
  {
    label: "WhatsApp",
    icon: WhatsAppIcon,
    href: (url: string, title: string) => `https://wa.me/?text=${title}%20${url}`,
  },
  {
    label: "E-mail",
    icon: Mail,
    href: (url: string, title: string) => `mailto:?subject=${title}&body=${url}`,
  },
];

export function ProductSpecs({
  product,
  ratingAverage,
  ratingCount,
}: {
  product: ProductWithRelations;
  ratingAverage: number;
  ratingCount: number;
}) {
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

  function openShare(href: string) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(product.name);
    window.open(href.replace("%URL%", url).replace("%TITLE%", title), "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-6">
      {ratingCount > 0 && (
        <a href="#avaliacoes" className="group flex w-fit flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="text-3xl font-bold leading-none text-fg">
              {ratingAverage.toFixed(2).replace(".", ",")}
            </span>
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`size-4 ${
                    i < Math.round(ratingAverage)
                      ? "fill-gold text-gold"
                      : "fill-line text-line"
                  }`}
                  strokeWidth={1.5}
                />
              ))}
            </span>
          </span>
          <span className="text-sm font-medium text-gold-text underline-offset-4 group-hover:underline">
            Ler {ratingCount} {ratingCount === 1 ? "avaliação" : "avaliações"}
          </span>
        </a>
      )}

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

      <div>
        <p className="mb-2 text-sm font-medium text-fg">Compartilhe o produto!</p>
        <div className="flex flex-wrap items-center gap-2">
          {SHARE_TARGETS.map(({ label, icon: Icon, href }) => (
            <button
              key={label}
              type="button"
              onClick={() => openShare(href("%URL%", "%TITLE%"))}
              aria-label={`Compartilhar no ${label}`}
              title={label}
              className="flex size-9 items-center justify-center rounded-full border border-line text-muted-foreground transition-colors duration-150 ease-out hover:border-gold hover:text-gold-text"
            >
              <Icon className="size-4" />
            </button>
          ))}
          {/* The device's own share sheet — the only one that reaches apps
              these links can't, and the fallback copies the URL. */}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartilhar ou copiar o link"
            title="Mais opções"
            className="flex size-9 items-center justify-center rounded-full border border-line text-muted-foreground transition-colors duration-150 ease-out hover:border-gold hover:text-gold-text"
          >
            <Share2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
