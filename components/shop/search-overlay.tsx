"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { searchProductsAction } from "@/lib/actions/search";
import type { ProductListItem } from "@/lib/data/products";

export function SearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setResults([]);
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none border-none bg-bg p-0 text-fg"
      >
        <DialogTitle className="sr-only">Buscar produtos</DialogTitle>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-6 border-b border-line px-8 py-6 md:px-12">
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              type="search"
              placeholder="BUSCAR PRODUTOS…"
              aria-label="Buscar produtos"
              className="text-heading flex-1 bg-transparent text-2xl outline-none placeholder:text-ink-muted md:text-4xl"
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar busca"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12">
            {loading && <p className="text-label">Buscando…</p>}

            {!loading && term.trim().length >= 2 && results.length === 0 && (
              <p className="text-label">Nenhum produto encontrado para “{term}”.</p>
            )}

            <ul className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/produto/${product.slug}`}
                    onClick={() => onOpenChange(false)}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#111111]">
                      {product.image && (
                        <Image
                          src={product.image.url}
                          alt={product.image.alt ?? product.name}
                          fill
                          sizes="(min-width: 768px) 20vw, 45vw"
                          className="object-cover transition-opacity duration-200 ease-out group-hover:opacity-80"
                        />
                      )}
                    </div>
                    <p className="mt-3 text-sm">{product.name}</p>
                    <p className="text-label !normal-case">
                      {formatCurrency(product.price)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
