import { createClient } from "@/lib/supabase/server";

export type InventoryRow = {
  id: string;
  color: string;
  size: string;
  sku: string | null;
  stock: number;
  product: { id: string; name: string; slug: string; image: string | null };
};

export async function getInventoryRows(): Promise<InventoryRow[]> {
  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id, color, size, sku, stock")
    .order("stock", { ascending: true });

  if (!variants || variants.length === 0) return [];

  const productIds = Array.from(new Set(variants.map((v) => v.product_id)));

  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, product_images(url, position)")
    .in("id", productIds);

  const productMap = new Map(
    (products ?? []).map((p) => {
      const sorted = [...p.product_images].sort((a, b) => a.position - b.position);
      return [p.id, { id: p.id, name: p.name, slug: p.slug, image: sorted[0]?.url ?? null }];
    }),
  );

  return variants.map((v) => ({
    id: v.id,
    color: v.color,
    size: v.size,
    sku: v.sku,
    stock: v.stock,
    product: productMap.get(v.product_id) ?? {
      id: v.product_id,
      name: "—",
      slug: "",
      image: null,
    },
  }));
}
