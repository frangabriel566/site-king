import "server-only";
import { and, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { roundMoney } from "@/lib/money";

export type RevisedItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  size: string;
  price: number;
  image: string | null;
  requestedQty: number;
  availableQty: number;
  stock: number;
  changed: boolean;
};

export type ReviseCartResult = {
  items: RevisedItem[];
  subtotal: number;
  hasChanges: boolean;
};

const { product_variants } = schema;

/** Uma variação que a sacola pode oferecer no lugar da que está lá. */
export type CartVariantOption = {
  id: string;
  color: string;
  size: string;
  stock: number;
};

/**
 * Todas as variações dos produtos que estão na sacola, com o saldo de
 * hoje — zero inclusive.
 *
 * Serve a duas coisas na sacola: o saldo de cada linha (a trava do "+" e
 * o aviso de esgotado) e os outros tamanhos da mesma cor, para trocar sem
 * sair dela. Uma consulta só, por produto e não por variação: trocar de
 * tamanho não precisa de outra ida ao servidor.
 *
 * Produto fora do ar não volta (mesma regra que reviseCartItems aplica),
 * e quem chama trata a variação ausente como saldo zero. Também existe
 * porque a sacola deixava somar quantidade sem limite: com quase todo o
 * catálogo em uma unidade por tamanho, o cliente via um total de três
 * peças e recebia um pedido de uma.
 */
export async function getCartVariants(
  productIds: string[],
): Promise<Record<string, CartVariantOption[]>> {
  if (productIds.length === 0) return {};

  const rows = await getDb().query.product_variants.findMany({
    columns: { id: true, product_id: true, color: true, size: true, stock: true },
    // Archived variants aren't offered (lib/products/variant-sync.ts); a
    // bag line still on one reads as sold out.
    where: and(
      inArray(product_variants.product_id, productIds.slice(0, 50)),
      isNull(product_variants.archived_at),
    ),
    with: { product: { columns: { status: true } } },
  });

  const byProduct: Record<string, CartVariantOption[]> = {};
  for (const row of rows) {
    if (row.product.status !== "active") continue;
    (byProduct[row.product_id] ??= []).push({
      id: row.id,
      color: row.color,
      size: row.size,
      stock: Math.max(row.stock, 0),
    });
  }
  return byProduct;
}

/**
 * Re-reads price and stock straight from the database for the given
 * variant ids — the cart in localStorage is never trusted as the
 * source of truth for money or availability.
 */
export async function reviseCartItems(
  requested: { variantId: string; qty: number }[],
): Promise<ReviseCartResult> {
  if (requested.length === 0) {
    return { items: [], subtotal: 0, hasChanges: false };
  }

  const variants = await getDb().query.product_variants.findMany({
    columns: { id: true, color: true, size: true, stock: true, archived_at: true },
    where: inArray(
      product_variants.id,
      requested.slice(0, 50).map((r) => r.variantId),
    ),
    with: {
      product: {
        columns: { id: true, slug: true, name: true, price: true, status: true },
        with: { product_images: { columns: { url: true, position: true } } },
      },
    },
  });

  let hasChanges = false;
  const items: RevisedItem[] = [];

  for (const req of requested) {
    const variant = variants.find((v) => v.id === req.variantId);
    if (!variant) {
      hasChanges = true;
      continue;
    }
    const product = variant.product;
    // An archived variant was taken out of the product: not for sale.
    if (product.status !== "active" || variant.archived_at) {
      hasChanges = true;
      continue;
    }

    const availableQty = Math.min(req.qty, Math.max(variant.stock, 0));
    if (availableQty !== req.qty) hasChanges = true;
    if (availableQty <= 0) {
      hasChanges = true;
      continue;
    }

    const images = [...product.product_images].sort((a, b) => a.position - b.position);

    items.push({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color: variant.color,
      size: variant.size,
      price: product.price,
      image: images[0]?.url ?? null,
      requestedQty: req.qty,
      availableQty,
      stock: variant.stock,
      changed: availableQty !== req.qty,
    });
  }

  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.price * i.availableQty, 0));

  return { items, subtotal, hasChanges };
}
