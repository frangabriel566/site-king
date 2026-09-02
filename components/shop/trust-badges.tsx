import { Truck, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { MAX_INSTALLMENTS } from "@/lib/format";

export function TrustBadges({ freeShippingNote }: { freeShippingNote: string | null }) {
  const items = [
    { icon: Truck, label: freeShippingNote ?? "Frete grátis em compras selecionadas" },
    { icon: CreditCard, label: `Parcele em até ${MAX_INSTALLMENTS}x sem juros` },
    { icon: RotateCcw, label: "Troca garantida em até 30 dias" },
    { icon: ShieldCheck, label: "Compra 100% segura" },
  ];

  return (
    <div className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 px-4 py-5 md:grid-cols-4 md:px-8">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
            <span className="text-xs font-medium text-fg sm:text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
