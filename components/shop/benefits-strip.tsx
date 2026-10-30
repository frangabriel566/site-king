import { CreditCard, ShieldCheck, Truck } from "lucide-react";
import type { SiteSettings } from "@/lib/data/settings";
import { formatCurrency } from "@/lib/format";
import { WhatsAppIcon } from "./whatsapp-icon";

type Benefit = { key: string; title: string; note: string; icon: React.ReactNode; href?: string };

/**
 * The benefits row right under the home's hero (King Store layout, out/2026):
 * a short title and a one-line note per item. Each one only when the store
 * has it — free shipping and installments come from Configurações, the
 * WhatsApp item from the store's number; "Compra segura" always shows.
 */
export function BenefitsStrip({ settings }: { settings: SiteSettings }) {
  const iconClass = "size-[26px] shrink-0 text-gold-text";
  const benefits: Benefit[] = [];

  if (settings.free_shipping_threshold) {
    benefits.push({
      key: "shipping",
      title: "Frete grátis",
      note: `Acima de ${formatCurrency(settings.free_shipping_threshold)}`,
      icon: <Truck className={iconClass} aria-hidden="true" />,
    });
  }
  if (settings.installments_max && settings.installments_max >= 2) {
    benefits.push({
      key: "installments",
      title: `${settings.installments_max}x sem juros`,
      note: "Cartão, Pix e boleto",
      icon: <CreditCard className={iconClass} aria-hidden="true" />,
    });
  }
  benefits.push({
    key: "secure",
    title: "Compra segura",
    note: "Pagamento protegido",
    icon: <ShieldCheck className={iconClass} aria-hidden="true" />,
  });
  if (settings.whatsapp) {
    benefits.push({
      key: "whatsapp",
      title: "Atendimento no WhatsApp",
      note: "Tire dúvidas de tamanho",
      icon: <WhatsAppIcon className={iconClass} />,
      href: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`,
    });
  }

  return (
    <section aria-label="Vantagens da loja" className="border-y border-line bg-[#13171a]">
      <ul className="mx-auto grid max-w-[1400px] grid-cols-1 gap-x-6 gap-y-4 px-4 py-5 min-[460px]:grid-cols-2 md:px-8 lg:grid-cols-4">
        {benefits.map((benefit) => {
          const content = (
            <>
              {benefit.icon}
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{benefit.title}</span>
                <span className="block text-[13px] text-muted-foreground">{benefit.note}</span>
              </span>
            </>
          );
          return (
            <li key={benefit.key}>
              {benefit.href ? (
                <a
                  href={benefit.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3.5 transition-opacity duration-150 ease-out hover:opacity-80"
                >
                  {content}
                </a>
              ) : (
                <div className="flex items-center gap-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
