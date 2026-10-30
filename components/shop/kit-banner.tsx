import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import { formatCurrency } from "@/lib/format";
import { installmentText } from "@/lib/shop-config";
import type { ProductListItem } from "@/lib/data/products";

/**
 * "Monte o look" (King Store layout, out/2026): the first product marked for
 * the KITS shelf, shown big between "Mais vendidos" and "Ofertas". The
 * button opens that product, or the whole shelf when there are several.
 */
export function KitBanner({
  kit,
  kitCount,
  seeAllHref,
  installmentsMax,
}: {
  kit: ProductListItem;
  kitCount: number;
  seeAllHref: string;
  installmentsMax: number | null;
}) {
  const installments = installmentText(kit.price, installmentsMax);
  const href = kitCount > 1 ? seeAllHref : `/produto/${kit.slug}`;

  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-12 pb-2 md:px-8">
      <div className="flex flex-wrap items-center gap-8 rounded-[18px] border border-gold bg-card p-6 shadow-[0_0_48px_rgba(205,169,107,0.2)] md:p-9">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
          <p className="font-label text-[11px] tracking-[0.2em] text-gold-text">MONTE O LOOK</p>
          <h2 className="!text-[clamp(2rem,6vw,2.75rem)] !font-black leading-none">{kit.name}</h2>
          <p className="text-base text-muted-foreground">
            O look completo de uma vez.{" "}
            {kit.compare_at_price ? (
              <>
                De <span className="line-through">{formatCurrency(kit.compare_at_price)}</span> por{" "}
              </>
            ) : (
              "Por "
            )}
            <strong className="text-fg">{formatCurrency(kit.price)}</strong>
            {installments ? ` ou ${installments}.` : "."}
          </p>
          <Link
            href={href}
            className="bg-buy inline-flex min-h-12 items-center self-start rounded-[10px] px-6 font-display text-base font-extrabold tracking-[0.06em] text-on-buy transition-colors duration-150 ease-out hover:bg-buy-hover"
          >
            {kitCount > 1 ? "VER KITS" : "VER O KIT"}
          </Link>
        </div>
        {kit.image && (
          <Link
            href={`/produto/${kit.slug}`}
            className="relative aspect-[16/10] min-w-0 flex-[1_1_300px] overflow-hidden rounded-xl border border-line"
          >
            <SafeImage
              src={kit.image.url}
              alt={kit.image.alt ?? kit.name}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </Link>
        )}
      </div>
    </section>
  );
}
