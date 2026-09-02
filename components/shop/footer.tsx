import Link from "next/link";
import Image from "next/image";
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Camera,
  Music2,
  PlayCircle,
  Mail,
} from "lucide-react";
import { Newsletter } from "./newsletter";
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
    <footer className="bg-fg text-bg">
      <div className="mx-auto max-w-[1400px] px-4 pt-14 pb-8 md:px-8">
        <div className="grid grid-cols-2 gap-10 pb-12 md:grid-cols-5">
          <div className="col-span-2">
            {settings.logo_url ? (
              <Image
                src={settings.logo_url}
                alt={settings.store_name}
                width={140}
                height={40}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">
                {settings.store_name}
              </p>
            )}
            <p className="mt-4 max-w-xs text-sm text-bg/70">
              {settings.shipping_note ?? "Vestuário masculino."}
            </p>
            <div className="mt-6 max-w-sm">
              <Newsletter variant="dark" />
            </div>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-bg/60">
              Categorias
            </p>
            <ul className="flex flex-col gap-3">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/colecao?categoria=${category.slug}`}
                    className="text-sm text-bg/80 transition-colors duration-150 ease-out hover:text-gold"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-bg/60">
              Institucional
            </p>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="/sobre" className="text-sm text-bg/80 hover:text-gold">
                  Sobre
                </Link>
              </li>
              <li>
                <Link
                  href="/trocas-e-devolucoes"
                  className="text-sm text-bg/80 hover:text-gold"
                >
                  Trocas e devoluções
                </Link>
              </li>
              <li>
                <Link
                  href="/politica-de-privacidade"
                  className="text-sm text-bg/80 hover:text-gold"
                >
                  Política de privacidade
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-bg/60">
              Atendimento
            </p>
            <ul className="flex flex-col gap-3">
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2 text-sm text-bg/80 hover:text-gold"
                  >
                    <Mail className="size-3.5" aria-hidden="true" />
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
                    className="text-sm text-bg/80 hover:text-gold"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-5 flex items-center gap-4">
              {settings.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="text-bg/80 hover:text-gold"
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
                  className="text-bg/80 hover:text-gold"
                >
                  <Music2 className="size-5" />
                </a>
              )}
              {settings.youtube && (
                <a
                  href={`https://youtube.com/${settings.youtube}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="text-bg/80 hover:text-gold"
                >
                  <PlayCircle className="size-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col items-center justify-between gap-6 pt-8 sm:flex-row">
          <p className="text-xs text-bg/60">
            © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
          </p>
          {settings.free_shipping_note && (
            <p className="text-xs text-bg/60">{settings.free_shipping_note}</p>
          )}
          <div className="flex items-center gap-5 text-bg/60">
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
