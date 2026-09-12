import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { getAllProductsAdmin } from "@/lib/data/products";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteProductAction } from "@/lib/actions/products";

export const metadata: Metadata = { title: "Produtos — Painel" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

export default async function AdminProductsPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Produtos</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/produtos/novo">
            <Plus className="size-4" /> Novo produto
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum produto cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => {
            const totalStock = product.product_variants.reduce(
              (sum, v) => sum + v.stock,
              0,
            );
            // Falls back to a variant's own color photo when the product
            // has no general gallery images at all.
            const thumbnail =
              product.product_images[0]?.url ??
              product.product_variants.find((v) => v.image_url)?.image_url ??
              null;
            return (
              <div
                key={product.id}
                className="flex flex-wrap items-center gap-4 border border-line p-4 md:gap-5"
              >
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-[#111111]">
                  {thumbnail && (
                    <Image
                      src={thumbnail}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm">{product.name}</p>
                  <p className="text-xs text-ink-muted">
                    {product.category?.name ?? "Sem categoria"} ·{" "}
                    {formatCurrency(product.price)} · {totalStock} em estoque
                  </p>
                </div>
                {product.featured && (
                  <Badge className="rounded-none">Destaque</Badge>
                )}
                <Badge variant="outline" className="rounded-none">
                  {STATUS_LABEL[product.status] ?? product.status}
                </Badge>
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={`/admin/produtos/${product.id}`} aria-label="Editar produto">
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <DeleteButton
                  itemLabel="produto"
                  action={deleteProductAction.bind(null, product.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
