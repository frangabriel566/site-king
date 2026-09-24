import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import type { CategoryShowcase } from "@/lib/data/categories";

export function CategoryStrip({ categories }: { categories: CategoryShowcase[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="mx-auto max-w-[1400px] pt-6 pb-4">
      <div className="scrollbar-hide overflow-x-auto">
        {/* One row at every width, however many categories there are.
            Wrapping used to drop the last one or two onto a second line on
            their own, which reads as a mistake rather than a layout.

            `w-max` + `mx-auto` is what keeps that honest: the row is
            exactly as wide as its tiles, so it centres while they fit and
            scrolls from the left once they don't. `justify-center` on the
            scroller itself would centre them too, but it pushes the first
            tiles into overflow that can't be scrolled back to. */}
        <div className="mx-auto flex w-max gap-4 px-4 md:px-8">
          {categories.map((category) => (
              <Link
                key={category.id}
                href={`/colecao?categoria=${category.slug}`}
                className="group flex w-24 shrink-0 flex-col items-center gap-3 md:w-28"
              >
                {/* One ground for the whole row, always black. A per-slug
                    white exception used to exist for categories shot on a
                    light backdrop, but it only moved the problem: the tile
                    that had it is photographed dark, so the white ring was
                    the loudest thing in the row. Black matches most of the
                    shots, and the gold monogram reads on it. */}
                <span
                  className={`relative flex size-24 items-center justify-center overflow-hidden rounded-full border border-gold/40 bg-black text-2xl font-bold tracking-wide text-gold shadow-sm transition-[border-color,box-shadow] duration-200 ease-out group-hover:border-gold group-hover:shadow-md md:size-28 md:text-3xl ${
                    category.image ? "" : "ring-1 ring-gold/15 ring-inset"
                  }`}
                >
                  {category.image ? (
                    // `cover`, and no padding, so the photo reaches the edge
                    // of the circle. Fitting the photo whole instead would
                    // leave its own backdrop showing as a square inside the
                    // tile, and the photos come from whichever product leads
                    // the category — their backdrops are not ours to match.
                    // Filling costs a crop; it buys a row that stays uniform
                    // whatever gets uploaded next.
                    <SafeImage
                      src={category.image.url}
                      alt={category.image.alt ?? category.name}
                      fill
                      sizes="(min-width: 768px) 112px, 96px"
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      fallbackLabel={category.name.charAt(0).toUpperCase()}
                    />
                  ) : (
                    category.name.charAt(0).toUpperCase()
                  )}
                </span>
                {/* Uppercased here rather than trusted to the data: the
                    names are typed by hand in the admin and arrive in
                    whatever case the operator used, which left one tile
                    shouting and its neighbour whispering. */}
                <span className="line-clamp-2 min-h-[2.1rem] text-center text-[13px] font-medium uppercase leading-tight tracking-wide text-fg">
                  {category.name}
                </span>
              </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
