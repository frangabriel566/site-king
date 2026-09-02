import { Truck, RotateCcw, ShieldCheck, CreditCard } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MAX_INSTALLMENTS } from "@/lib/format";

export function ProductInfoTabs({
  description,
  shippingNote,
  exchangeInfo,
  freeShippingNote,
}: {
  description: string | null;
  shippingNote: string | null;
  exchangeInfo: string | null;
  freeShippingNote: string | null;
}) {
  const items = [
    { icon: Truck, label: shippingNote ?? "Entrega para todo o Brasil" },
    { icon: CreditCard, label: `Até ${MAX_INSTALLMENTS}x sem juros` },
    { icon: RotateCcw, label: exchangeInfo ?? "Troca grátis em 30 dias" },
    { icon: ShieldCheck, label: freeShippingNote ?? "Compra 100% segura" },
  ];

  const featuresPanel = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center"
        >
          <Icon className="size-6 text-gold-text" aria-hidden="true" />
          <span className="text-xs text-fg">{label}</span>
        </div>
      ))}
    </div>
  );

  if (!description) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-bold text-fg">Principais características</h2>
        {featuresPanel}
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
