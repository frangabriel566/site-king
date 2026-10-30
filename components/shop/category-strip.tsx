import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import type { CategoryShowcase } from "@/lib/data/categories";

/**
 * "Compre por categoria" (King Store layout, out/2026): a titled row of
 * rounded square tiles that scrolls sideways. The photo is the one the
 * category already shows (its first product's); without one, the tile
 * shows the initial in gold.
 */
export function CategoryStrip({ categories }: { categories: CategoryShowcase[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] pt-12 pb-2">
      <h2 className="mb-5 px-4 text-2xl md:px-8 md:text-[30px]">Compre por categoria</h2>
      <div className="scrollbar-hide snap-x snap-mandatory overflow-x-auto">
        <ul className="flex w-max gap-3.5 px-4 md:px-8">
          {categories.map((category) => (
            <li key={category.id} className="snap-start">
              <Link
                href={`/colecao?categoria=${category.slug}`}
                className="group flex w-[130px] flex-col gap-2.5 md:w-[150px]"
              >
                <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[14px] border border-line bg-card text-3xl font-bold text-gold transition-[border-color,box-shadow] duration-200 ease-out group-hover:border-gold group-hover:shadow-[0_0_24px_rgba(205,169,107,0.25)]">
                  {category.image ? (
                    <SafeImage
                      src={category.image.url}
                      alt={category.image.alt ?? category.name}
                      fill
                      sizes="150px"
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      fallbackLabel={category.name.charAt(0).toUpperCase()}
                    />
                  ) : (
                    category.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="line-clamp-2 text-center font-label text-[11px] uppercase leading-snug tracking-[0.08em] text-fg">
                  {category.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
