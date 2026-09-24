import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import { CreditCard, ShieldCheck, Lock, Camera, Music2, Mail } from "lucide-react";
import { FooterNewsletter } from "./footer-newsletter";
import { FooterAccordionSection } from "./footer-accordion-section";
import { WhatsAppIcon } from "./whatsapp-icon";
import type { SiteSettings } from "@/lib/data/settings";
import type { Category } from "@/lib/data/categories";

export function Footer({
  settings,
  categories,
}: {
  settings: SiteSettings;
  categories: Category[];
}) {
  return (
    <footer className="bg-black text-bg">
      <div className="mx-auto max-w-[1400px] px-4 pt-10 pb-6 sm:pt-14 sm:pb-8 md:px-8">
        <div className="divide-y divide-white/10 pb-2 lg:grid lg:grid-cols-5 lg:gap-10 lg:divide-y-0 lg:pb-12">
          <div className="pb-5 lg:col-span-2 lg:pb-0">
            {settings.logo_url ? (
              <SafeImage
                src={settings.logo_url}
                alt={settings.store_name}
                width={140}
                height={40}
                className="h-9 w-auto object-contain"
                fallbackLabel={settings.store_name}
              />
            ) : (
              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">
                {settings.store_name}
              </p>
            )}
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

          {settings.free_shipping_note && (
            <p className="hidden text-xs text-bg/60 sm:block">{settings.free_shipping_note}</p>
          )}

          <div className="hidden items-center gap-5 text-bg/60 sm:flex">
            <span className="flex items-center gap-1.5 text-xs">
              <CreditCard className="size-4" aria-hidden="true" /> Cartão, Pix e boleto
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <Lock className="size-4" aria-hidden="true" /> Compra segura
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-4" aria-hidden="true" /> Dados protegidos
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
