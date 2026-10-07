import { Truck, RotateCcw, ShieldCheck, CreditCard } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trustItems, type ShopConfig, type TrustItemKind } from "@/lib/shop-config";

const ICONS: Record<TrustItemKind, typeof Truck> = {
  shipping: Truck,
  installments: CreditCard,
  exchange: RotateCcw,
  secure: ShieldCheck,
};

export function ProductInfoTabs({
  description,
  shippingNote,
  exchangeInfo,
  config,
}: {
  description: string | null;
  /** The product's own delivery copy, else the store's "frase de envio". */
  shippingNote: string | null;
  /** The product's own exchange copy; falls back to the store's. */
  exchangeInfo: string | null;
  config: ShopConfig;
}) {
  // Only lines the product or the store actually filled in.
  const items = trustItems(config, ["shipping", "installments", "exchange", "secure"], {
    shipping: shippingNote,
    exchange: exchangeInfo ?? config.exchangeNote,
  });

  const featuresPanel =
    items.length > 0 ? (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map(({ kind, label }) => {
          const Icon = ICONS[kind];
          return (
            <div
              key={kind}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center"
            >
              <Icon className="size-6 text-gold-text" aria-hidden="true" />
              <span className="text-xs text-fg">{label}</span>
            </div>
          );
        })}
      </div>
    ) : null;

  if (!description) {
    if (!featuresPanel) return null;
    return (
      <section>
        <h2 className="mb-4 text-lg font-bold text-fg">Principais características</h2>
        {featuresPanel}
      </section>
    );
  }

  if (!featuresPanel) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-bold text-fg">Descrição</h2>
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg">
          {description}
        </p>
      </section>
    );
  }

  return (
    <Tabs defaultValue="descricao">
      <TabsList
        variant="line"
        className="mb-6 h-auto gap-6 border-b border-line p-0"
      >
        <TabsTrigger
          value="descricao"
          className="rounded-none border-0 px-0 pb-3 text-base font-semibold text-muted-foreground data-active:text-fg"
        >
          Descrição
        </TabsTrigger>
        <TabsTrigger
          value="caracteristicas"
          className="rounded-none border-0 px-0 pb-3 text-base font-semibold text-muted-foreground data-active:text-fg"
        >
          Principais características
        </TabsTrigger>
      </TabsList>
      <TabsContent value="descricao">
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg">
          {description}
        </p>
      </TabsContent>
      <TabsContent value="caracteristicas">{featuresPanel}</TabsContent>
    </Tabs>
  );
}
