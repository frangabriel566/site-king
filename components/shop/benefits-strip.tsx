import Link from "next/link";
import { CreditCard, RotateCcw } from "lucide-react";
import type { SiteSettings } from "@/lib/data/settings";
import { WhatsAppIcon } from "./whatsapp-icon";

type Benefit = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  external?: boolean;
};

const COLUMNS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

/**
 * The home's benefits row — WhatsApp, parcelamento, trocas. Each one only
 * when the store has it: a WhatsApp number, an installment rule and an
 * exchange note (Configurações). Nothing is printed by default, and with
 * none of the three set the row isn't rendered.
 */
export function BenefitsStrip({ settings }: { settings: SiteSettings }) {
  const iconClass = "size-5";
  const benefits: Benefit[] = [];

  if (settings.whatsapp) {
    benefits.push({
      key: "whatsapp",
      label: "Atendimento no WhatsApp",
      icon: <WhatsAppIcon className={iconClass} />,
      href: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`,
      external: true,
    });
  }
  if (settings.installments_max && settings.installments_max >= 2) {
    benefits.push({
      key: "installments",
      label: `Até ${settings.installments_max}x sem juros`,
      icon: <CreditCard className={iconClass} aria-hidden="true" />,
    });
  }
  if (settings.exchange_note) {
    benefits.push({
      key: "exchange",
      label: settings.exchange_note,
      icon: <RotateCcw className={iconClass} aria-hidden="true" />,
      href: "/trocas-e-devolucoes",
    });
  }

  if (benefits.length === 0) return null;

  return (
    <section aria-label="Vantagens da loja" className="border-y border-line bg-surface">
      <ul
        className={`mx-auto grid max-w-[1400px] divide-x divide-line px-2 py-4 md:px-8 md:py-5 ${
          COLUMNS[benefits.length]
        }`}
      >
        {benefits.map((benefit) => {
          const content = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-gold-text shadow-sm">
                {benefit.icon}
              </span>
              <span className="text-xs font-semibold leading-tight text-fg md:text-sm">
                {benefit.label}
              </span>
            </>
          );
          const className =
            "flex h-full flex-col items-center justify-center gap-2 px-2 text-center md:flex-row md:gap-3";
          return (
            <li key={benefit.key}>
              {benefit.href && benefit.external ? (
                <a
                  href={benefit.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${className} hover:underline`}
                >
                  {content}
                </a>
              ) : benefit.href ? (
                <Link href={benefit.href} className={`${className} hover:underline`}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
