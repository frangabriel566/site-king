"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { searchProductsAction } from "@/lib/actions/search";
import type { ProductListItem } from "@/lib/data/products";

/** Always-visible search bar with a results dropdown — replaces the old
 *  full-screen search overlay to match the retail header pattern. Used
 *  both inline (desktop, centered in the header) and full-width (mobile,
 *  its own row). */
export function HeaderSearch({ className = "" }: { className?: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const items = await searchProductsAction(term);
      setResults(items);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showPanel = open && term.trim().length >= 2;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-fg">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          type="search"
          placeholder="Buscar produtos, categorias..."
          aria-label="Buscar produtos"
          className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted-foreground"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setResults([]);
            }}
            aria-label="Limpar busca"
            className="shrink-0 text-muted-foreground hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-line bg-white p-3 text-fg shadow-lg">
          {loading && <p className="px-2 py-3 text-sm text-muted-foreground">Buscando…</p>}

          {!loading && results.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Nenhum produto encontrado para &ldquo;{term}&rdquo;.
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/produto/${product.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-surface"
                  >
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-surface">
                      {product.image && (
                        <Image
                          src={product.image.url}
                          alt={product.image.alt ?? product.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{product.name}</p>
                      <p className="text-sm font-semibold text-price">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
