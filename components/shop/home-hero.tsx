import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { SafeImage } from "@/components/shop/safe-image";
import { formatCurrency } from "@/lib/format";

/**
 * The top of the home page in the King Store layout (out/2026): the
 * "Vista-se como um rei" line, a headline with the lowest price on the
 * shelves, and the two ways to buy side by side. The photo is the first
 * active banner's (Banners in the panel), so swapping it needs no deploy;
 * with no banner the text simply takes the full width.
 */
export function HomeHero({
  fromPrice,
  imageUrl,
  imageAlt,
  whatsappHref,
}: {
  /** Lowest price among the products on the home shelves; null hides it. */
  fromPrice: number | null;
  imageUrl: string | null;
  imageAlt: string;
  whatsappHref: string | null;
}) {
  return (
    <section className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-10 px-4 pb-10 pt-10 md:px-8 md:pt-14">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5">
        <p className="flex items-center gap-3.5 font-label text-[11px] tracking-[0.22em] text-fg sm:text-xs">
          <span
            aria-hidden="true"
            className="h-0.5 w-12 shrink-0 bg-gold-text shadow-[0_0_12px_rgba(205,169,107,0.8)]"
          />
          VISTA-SE COMO UM <span className="text-gold-text">REI</span>
        </p>
        <h1 className="!text-[clamp(2.75rem,9vw,4rem)] !font-black leading-[0.98]">
          Grifes importadas
          {fromPrice !== null && (
            <>
              {" "}
              a partir de <span className="text-gold-text">{formatCurrency(fromPrice)}</span>
            </>
          )}
        </h1>
        <p className="max-w-[520px] text-base leading-relaxed text-muted-foreground sm:text-lg">
          Peruanas, polos, sarjas e bermudas das marcas que você usa. Parcele em 3x sem juros
          ou feche direto pelo WhatsApp.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/colecao"
            className="bg-buy inline-flex min-h-[52px] items-center gap-2.5 rounded-[10px] px-7 font-display text-[17px] font-extrabold tracking-[0.06em] text-on-buy transition-colors duration-150 ease-out hover:bg-buy-hover"
          >
            COMPRAR AGORA
            <ArrowRight className="size-[18px]" aria-hidden="true" />
          </Link>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[52px] items-center gap-2.5 rounded-[10px] border border-line-strong px-6 text-[15px] font-semibold transition-colors duration-150 ease-out hover:border-gold"
            >
              <MessageCircle className="size-[18px]" aria-hidden="true" />
              Comprar pelo WhatsApp
            </a>
          )}
        </div>
      </div>

      {imageUrl && (
        <div className="relative aspect-[4/5] max-h-[560px] min-w-0 flex-[1_1_380px] overflow-hidden rounded-2xl border border-gold shadow-[0_0_60px_rgba(205,169,107,0.22)]">
          <SafeImage
            src={imageUrl}
            alt={imageAlt}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
    </section>
  );
}
