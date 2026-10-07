import "server-only";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";

export type InventoryRow = {
  id: string;
  color: string;
  size: string;
  sku: string | null;
  stock: number;
  product: { id: string; name: string; slug: string; image: string | null };
};

export async function getInventoryRows(): Promise<InventoryRow[]> {
  await requireAdminPage();

  const variants = await getDb().query.product_variants.findMany({
    columns: { id: true, product_id: true, color: true, size: true, sku: true, stock: true },
    orderBy: asc(schema.product_variants.stock),
    with: {
      product: {
        columns: { id: true, name: true, slug: true },
        with: { product_images: { columns: { url: true, position: true } } },
      },
    },
  });

  return variants.map((v) => {
    const [firstImage] = [...v.product.product_images].sort((a, b) => a.position - b.position);
    return {
      id: v.id,
      color: v.color,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
      product: {
        id: v.product.id,
        name: v.product.name,
        slug: v.product.slug,
        image: firstImage?.url ?? null,
      },
    };
  });
}
