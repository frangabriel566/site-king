"use client";

import { useEffect, useMemo, useState } from "react";
import { getCartVariantsAction } from "@/lib/actions/checkout";
import type { CartItem } from "@/lib/cart/types";
import type { CartVariantOption } from "@/lib/data/checkout";
import { SIZE_ORDER, isSimpleVariant } from "@/lib/constants";

export type { CartVariantOption };

export type CartStock = {
  /** Saldo de cada variação. `null` enquanto a consulta não voltou — é o
   *  que distingue "ainda não sei" de "acabou", e evita a sacola piscar
   *  tudo como esgotado no primeiro render. */
  stock: Record<string, number> | null;
  /** Quanto resta desta variação, ou `null` enquanto não se sabe. */
  limitOf: (variantId: string) => number | null;
  /** Já é possível afirmar que não há saldo nenhum. */
  isSoldOut: (variantId: string) => boolean;
  /** Os tamanhos que esta linha pode trocar: mesma peça, mesma cor, na
   *  ordem da grade (PP…GG, depois números). Vazio enquanto não se sabe e
   *  para peça sem variações ou de tamanho único — aí não há o que trocar. */
  sizesFor: (item: CartItem) => CartVariantOption[];
};

/**
 * Lê o estoque das variações que estão na sacola.
 *
 * A sacola vive em `localStorage` e não guarda saldo — ela sabe o que o
 * cliente escolheu, não o que a loja ainda tem. Sem isto o botão "+"
 * subia sem teto e o total exibido era uma promessa que o pedido não
 * cumpria, porque tanto o checkout quanto a compra por WhatsApp aparam
 * a quantidade ao estoque no servidor.
 *
 * A consulta é por produto e traz todas as variações dele, o que também
 * alimenta a troca de tamanho na própria sacola. Ela é refeita só quando
 * o conjunto de produtos muda — mexer na quantidade ou trocar o tamanho
 * não dispara ida ao servidor.
 */
/** `true` quando somar mais um passaria do que existe. Com o saldo ainda
 *  desconhecido (`limit` nulo) não trava nada — o servidor continua sendo
 *  quem decide, e travar por precaução barraria uma sacola válida. */
export function atStockLimit(limit: number | null, qty: number): boolean {
  return limit !== null && qty >= limit;
}

/** A frase que explica a trava, ou `null` quando não há o que dizer. */
export function stockNote(limit: number | null, qty: number): string | null {
  if (limit === null) return null;
  if (limit <= 0) return "Esgotado — não entra no pedido";
  if (qty >= limit) return limit === 1 ? "Última unidade" : `Só restam ${limit}`;
  return null;
}

function sizeRank(size: string): number {
  const index = (SIZE_ORDER as readonly string[]).indexOf(size);
  if (index >= 0) return index;
  const number = Number(size);
  return Number.isFinite(number) ? 100 + number : 1000;
}

/**
 * @param enabled A gaveta da sacola é montada no layout, ou seja, em
 * *toda* página da loja. Sem este interruptor, cada navegação dispararia
 * uma ida ao servidor para um painel que o cliente nem abriu — por isso
 * ela só consulta quando está aberta, e a página da sacola sempre.
 */
export function useCartStock(items: CartItem[], enabled = true): CartStock {
  const [variants, setVariants] = useState<Record<string, CartVariantOption[]> | null>(null);

  // Chave estável: ordenada, para que reordenar a sacola não conte como
  // mudança, e em string para não recriar o efeito a cada render.
  const key = useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort().join(","),
    [items],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!key) {
      setVariants({});
      return;
    }

    let alive = true;
    getCartVariantsAction(key.split(","))
      .then((result) => {
        if (alive) setVariants(result);
      })
      .catch(() => {
        // Falhou a consulta: melhor não saber do que travar a sacola. O
        // servidor continua sendo quem decide na hora do pedido.
        if (alive) setVariants(null);
      });

    return () => {
      alive = false;
    };
  }, [key, enabled]);

  return useMemo(() => {
    const stock: Record<string, number> | null = variants
      ? Object.fromEntries(
          Object.values(variants)
            .flat()
            .map((variant) => [variant.id, variant.stock]),
        )
      : null;
    return {
      stock,
      limitOf: (variantId: string) => (stock ? (stock[variantId] ?? 0) : null),
      isSoldOut: (variantId: string) => Boolean(stock) && (stock?.[variantId] ?? 0) <= 0,
      sizesFor: (item: CartItem) => {
        if (!variants || isSimpleVariant(item.color, item.size)) return [];
        const sizes = (variants[item.productId] ?? [])
          .filter((variant) => variant.color === item.color)
          .sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
        return sizes.length > 1 ? sizes : [];
      },
    };
  }, [variants]);
}
