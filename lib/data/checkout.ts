import "server-only";
import { inArray } from "drizzle-orm";
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

/**
 * Quanto existe hoje de cada variação da sacola — zero inclusive.
 *
 * Separada de `reviseCartItems` de propósito: aquela monta o pedido e
 * por isso **descarta** as linhas sem saldo, o que serve ao checkout e
 * não serve à sacola, que precisa justamente dizer "esta aqui acabou".
 * Aqui a resposta é um mapa cru, e o que não voltou (variação apagada,
 * produto tirado do ar) é tratado como zero por quem chama.
 *
 * Existe porque a sacola deixava somar quantidade sem limite: com quase
 * todo o catálogo em uma unidade por tamanho, o cliente via um total de
 * três peças e recebia um pedido de uma.
 */
export async function getCartStock(
  variantIds: string[],
): Promise<Record<string, number>> {
  if (variantIds.length === 0) return {};

  const rows = await getDb().query.product_variants.findMany({
    columns: { id: true, stock: true },
    where: inArray(product_variants.id, variantIds.slice(0, 50)),
    with: { product: { columns: { status: true } } },
  });

  const stock: Record<string, number> = {};
  for (const row of rows) {
    // Produto arquivado não se vende, então o saldo dele é zero para
    // efeito de sacola — mesma regra que reviseCartItems aplica.
    stock[row.id] = row.product.status === "active" ? Math.max(row.stock, 0) : 0;
  }
  return stock;
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
    columns: { id: true, color: true, size: true, stock: true },
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
    if (product.status !== "active") {
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
