import Link from "next/link";
import { StoreLogo } from "@/components/store-logo";
import { CreditCard, ShieldCheck, Lock, Camera, Music2, Mail } from "lucide-react";
import { FooterNewsletter } from "./footer-newsletter";
import { FooterAccordionSection } from "./footer-accordion-section";
import { WhatsAppIcon } from "./whatsapp-icon";
import type { SiteSettings } from "@/lib/data/settings";
import type { CategoryLink } from "@/lib/data/categories";
import { freeShippingText } from "@/lib/shop-config";

export function Footer({
  settings,
  categories,
  paymentText,
}: {
  settings: SiteSettings;
  categories: CategoryLink[];
  /** "Formas de pagamento" for how the store sells now — the online or the
   * WhatsApp version (Configurações → Rodapé, lib/sales-mode.ts). */
  paymentText: string | null;
}) {
  const shippingLine = freeShippingText({
    freeShippingThreshold: settings.free_shipping_threshold,
    freeShippingNote: settings.free_shipping_note,
  });
  const seals = [
    { key: "payment", text: paymentText, Icon: CreditCard },
    { key: "security", text: settings.footer_security_text, Icon: Lock },
    { key: "privacy", text: settings.footer_privacy_text, Icon: ShieldCheck },
  ].filter((seal): seal is typeof seal & { text: string } => Boolean(seal.text));

  return (
    <footer className="bg-black text-bg">
      <div className="mx-auto max-w-[1400px] px-4 pt-10 pb-6 sm:pt-14 sm:pb-8 md:px-8">
        <div className="divide-y divide-white/10 pb-2 lg:grid lg:grid-cols-5 lg:gap-10 lg:divide-y-0 lg:pb-12">
          <div className="pb-5 lg:col-span-2 lg:pb-0">
            <Link href="/" className="inline-block select-none">
              <StoreLogo
                logoUrl={settings.logo_url}
                name={settings.store_name}
                imageClassName="h-9 max-w-[200px]"
                textClassName="text-sm font-extrabold uppercase tracking-[0.08em] text-gold"
              />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-bg/70">
              {settings.shipping_note ?? "Vestuário masculino."}
            </p>
            <div className="mt-5 max-w-sm lg:mt-6">
              <FooterNewsletter />
            </div>
          </div>

          <FooterAccordionSection title="Categorias">
            <ul className="flex flex-col lg:gap-1">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/colecao?categoria=${category.slug}`}
                    className="block py-2 text-sm text-bg/80 transition-colors duration-150 ease-out hover:text-gold lg:py-1"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterAccordionSection>

          <FooterAccordionSection title="Institucional">
            <ul className="flex flex-col lg:gap-1">
              <li>
                <Link href="/sobre" className="block py-2 text-sm text-bg/80 hover:text-gold lg:py-1">
                  Sobre
                </Link>
              </li>
              <li>
                <Link
                  href="/trocas-e-devolucoes"
                  className="block py-2 text-sm text-bg/80 hover:text-gold lg:py-1"
                >
                  Trocas e devoluções
                </Link>
              </li>
              <li>
                <Link
                  href="/politica-de-privacidade"
                  className="block py-2 text-sm text-bg/80 hover:text-gold lg:py-1"
                >
                  Política de privacidade
                </Link>
              </li>
            </ul>
          </FooterAccordionSection>

          <FooterAccordionSection title="Atendimento">
            <ul className="flex flex-col lg:gap-1">
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2 py-2 text-sm text-bg/80 hover:text-gold lg:py-1"
                  >
                    <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                    {settings.email}
                  </a>
                </li>
              )}
              {settings.whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block py-2 text-sm text-bg/80 hover:text-gold lg:py-1"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </FooterAccordionSection>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:justify-between sm:pt-8">
          {/* The icons stay 20px; the links around them are 44px so they
              can actually be hit with a thumb. `gap-1` keeps the glyphs
              about as far apart as they looked before that padding
              existed, and the negative margin pulls the first one back
              onto the footer's left edge on desktop. */}
          <div className="-ml-3 flex items-center gap-1">
            {settings.instagram && (
              <a
                href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-11 touch-manipulation items-center justify-center text-bg/80 hover:text-gold"
              >
                <Camera className="size-5" />
              </a>
            )}
            {settings.tiktok && (
              <a
                href={`https://tiktok.com/${settings.tiktok.replace("@", "@")}`}
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="flex size-11 touch-manipulation items-center justify-center text-bg/80 hover:text-gold"
              >
                <Music2 className="size-5" />
              </a>
            )}
            {settings.whatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex size-11 touch-manipulation items-center justify-center text-bg/80 hover:text-gold"
              >
                <WhatsAppIcon className="size-5" />
              </a>
            )}
          </div>

          <p className="text-xs text-bg/60">
            © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
          </p>

          {/* The rule first, like the header and the trust strip — the
              free-text note alone could promise a value the checkout
              doesn't apply. */}
          {shippingLine && (
            <p className="hidden text-xs text-bg/60 sm:block">{shippingLine}</p>
          )}

          {/* Configurações → Rodapé; each badge only when filled in. On a
              phone too now — they wrap under the copyright line. */}
          {seals.length > 0 && (
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-bg/70">
              {seals.map(({ key, text, Icon }) => (
                <li key={key} className="flex items-center gap-1.5 text-xs">
                  <Icon className="size-4" aria-hidden="true" /> {text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
