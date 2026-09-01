import Link from "next/link";
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
    <footer className="border-t border-line bg-bg px-8 pt-16 pb-8 text-fg md:px-12">
      <div className="grid grid-cols-2 gap-10 pb-16 md:grid-cols-5">
        <div className="col-span-2">
          <p className="text-sm font-extrabold uppercase tracking-[0.1em]">
            {settings.store_name}
          </p>
          <p className="mt-4 max-w-xs text-sm text-ink-muted">
            {settings.shipping_note ?? "Vestuário masculino editorial."}
          </p>
          <div className="mt-8 max-w-sm">
            <Newsletter />
          </div>
        </div>

        <div>
          <p className="text-label mb-4">Categorias</p>
          <ul className="flex flex-col gap-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/colecao?categoria=${category.slug}`}
                  className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-label mb-4">Institucional</p>
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="/sobre"
                className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
              >
                Sobre
              </Link>
            </li>
            <li>
              <Link
                href="/trocas-e-devolucoes"
                className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
              >
                Trocas e devoluções
              </Link>
            </li>
            <li>
              <Link
                href="/politica-de-privacidade"
                className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
              >
                Política de privacidade
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-label mb-4">Contato</p>
          <ul className="flex flex-col gap-3">
            {settings.email && (
              <li>
                <a
                  href={`mailto:${settings.email}`}
                  className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
                >
                  {settings.email}
                </a>
              </li>
            )}
            {settings.instagram && (
              <li>
                <a
                  href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
                >
                  Instagram
                </a>
              </li>
            )}
            {settings.tiktok && (
              <li>
                <a
                  href={`https://tiktok.com/${settings.tiktok.replace("@", "@")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink-muted transition-colors duration-200 ease-out hover:text-fg"
                >
                  TikTok
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="hairline" />

      <div className="flex flex-col items-center justify-between gap-4 pt-8 text-center sm:flex-row sm:text-left">
        <p className="text-label">
          © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
        </p>
        {settings.free_shipping_note && (
          <p className="text-label">{settings.free_shipping_note}</p>
        )}
      </div>
    </footer>
  );
}
