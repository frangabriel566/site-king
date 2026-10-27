import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guards";
import { getEditableStoreSale } from "@/lib/data/store-sales";
import { formatLocalDateTime } from "@/lib/store-sales/period";
import { StoreSaleForm } from "../../nova/store-sale-form";

export const metadata: Metadata = { title: "Editar venda — Vendas na loja" };

/** Reads the sale and the stock as they are now; never cached HTML. */
export const dynamic = "force-dynamic";

export default async function EditStoreSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; data?: string }>;
}) {
  const { id } = await params;
  const { periodo, data } = await searchParams;
  await requireAdminPage(`/admin/vendas-loja/${id}/editar`);
  const sale = await getEditableStoreSale(id);
  if (!sale) notFound();

  // Back to the period the history was showing.
  const query = new URLSearchParams(
    Object.entries({ periodo, data }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  const backHref = `/admin/vendas-loja${query ? `?${query}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Editar venda #{sale.sale_number}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Registrada em {formatLocalDateTime(sale.created_at)}. O número e a data continuam os mesmos.
        </p>
      </div>
      {sale.canceled_at && (
        <p role="note" className="rounded-lg border border-line-strong bg-card p-4 text-sm">
          Esta venda foi desfeita. Ao salvar, ela <strong>volta a valer</strong>: as peças saem do estoque de novo,
          também no site, e a venda volta aos totais.
        </p>
      )}
      <StoreSaleForm sale={sale} backHref={backHref} />
    </div>
  );
}
