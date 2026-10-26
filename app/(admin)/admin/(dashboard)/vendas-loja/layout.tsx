import { StoreSalesTabs } from "./store-sales-tabs";

/** Vendas na loja física: the counter's own sales, kept apart from the
 * site's orders. The three tabs share this header. */
export default function StoreSalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Vendas na loja</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Baixa das peças vendidas no balcão. O estoque é o mesmo do site, mas os valores
          ficam separados dos pedidos online.
        </p>
      </div>
      <StoreSalesTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
