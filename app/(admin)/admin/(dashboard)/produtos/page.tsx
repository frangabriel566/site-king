import type { Metadata } from "next";
import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import { Plus, Pencil, AlertTriangle } from "lucide-react";
import { getAllProductsAdmin, type AdminProductListItem } from "@/lib/data/products";
import { PRODUCT_SECTIONS, SECTION_LABEL, isProductSection, type ProductSection } from "@/lib/sections";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusBadge, PRODUCT_STATUS_TONE } from "@/components/admin/status-badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteProductAction } from "@/lib/actions/products";

export const metadata: Metadata = { title: "Produtos — Painel" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

/** "Sem seção": products on no shelf at all. */
const NO_SECTION = "sem";

/** A product marked for Ofertas but with no real "de" price shows on the
 * shelf at its normal price — flagged here, never blocked. */
function offerWithoutPromo(product: AdminProductListItem): boolean {
  return (
    product.product_sections.some((entry) => entry.section === "ofertas") &&
    !(product.compare_at_price !== null && product.compare_at_price > product.price)
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ secao?: string }>;
}) {
  const { secao } = await searchParams;
  const all = await getAllProductsAdmin();
  const filter: ProductSection | typeof NO_SECTION | null = isProductSection(secao)
    ? secao
    : secao === NO_SECTION
      ? NO_SECTION
      : null;

  const positionIn = (product: AdminProductListItem, section: ProductSection) =>
    product.product_sections.find((entry) => entry.section === section);

  // Filtered by a shelf, the list reads in that shelf's order: numbered
  // first, then the rest newest first — the same order as the site.
  const products =
    filter === null
      ? all
      : filter === NO_SECTION
        ? all.filter((product) => product.product_sections.length === 0)
        : all
            .filter((product) => positionIn(product, filter))
            .sort((a, b) => {
              const pa = positionIn(a, filter)?.position ?? null;
              const pb = positionIn(b, filter)?.position ?? null;
              if (pa !== pb) return pa === null ? 1 : pb === null ? -1 : pa - pb;
              return b.created_at.localeCompare(a.created_at);
            });

  const tabs: { value: string | null; label: string; count: number }[] = [
    { value: null, label: "Todos", count: all.length },
    ...PRODUCT_SECTIONS.map((section) => ({
      value: section,
      label: SECTION_LABEL[section],
      count: all.filter((product) => positionIn(product, section)).length,
    })),
    {
      value: NO_SECTION,
      label: "Sem seção",
      count: all.filter((product) => product.product_sections.length === 0).length,
    },
  ];

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

      <nav aria-label="Filtrar por seção" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.value;
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/admin/produtos?secao=${tab.value}` : "/admin/produtos"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
                active
                  ? "border-accent-solid bg-accent-solid text-white"
                  : "border-line text-ink-muted hover:border-ink-muted hover:text-fg"
              }`}
            >
              {tab.label} <span className="opacity-70">{tab.count}</span>
            </Link>
          );
        })}
      </nav>

      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {filter ? "Nenhum produto nesta seção." : "Nenhum produto cadastrado."}
        </p>
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
                className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-card p-4 transition-colors duration-150 ease-out hover:border-line-strong md:gap-5"
              >
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-field">
                  {thumbnail && (
                    <SafeImage
                      src={thumbnail}
                      alt=""
                      fill
                      sizes="56px"
                      fallbackLabel=""
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
                {product.product_sections.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {PRODUCT_SECTIONS.filter((section) => positionIn(product, section)).map((section) => {
                      const position = positionIn(product, section)?.position;
                      const warn = section === "ofertas" && offerWithoutPromo(product);
                      return (
                        <span
                          key={section}
                          title={warn ? "Em Ofertas sem preço promocional" : undefined}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            warn ? "border-warning/50 text-warning" : "border-line text-ink-muted"
                          }`}
                        >
                          {warn && <AlertTriangle className="size-3" aria-hidden="true" />}
                          {SECTION_LABEL[section]}
                          {position ? <span className="text-fg">#{position}</span> : null}
                        </span>
                      );
                    })}
                  </div>
                )}
                {product.featured && (
                  <StatusBadge tone="info">Destaque</StatusBadge>
                )}
                <StatusBadge tone={PRODUCT_STATUS_TONE[product.status]}>
                  {STATUS_LABEL[product.status] ?? product.status}
                </StatusBadge>
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
