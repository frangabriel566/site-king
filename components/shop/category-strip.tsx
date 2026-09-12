import Link from "next/link";
import Image from "next/image";
import type { CategoryShowcase } from "@/lib/data/categories";

export function CategoryStrip({ categories }: { categories: CategoryShowcase[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-4 md:px-8">
      <div className="scrollbar-hide flex gap-4 overflow-x-auto md:flex-wrap md:justify-center md:overflow-visible">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/colecao?categoria=${category.slug}`}
            className="group flex w-24 shrink-0 flex-col items-center gap-3 sm:w-28"
          >
            <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-full border border-gold/40 bg-surface text-xl font-bold text-gold-text shadow-sm transition-[border-color,box-shadow] duration-200 ease-out group-hover:border-gold group-hover:shadow-md md:size-28">
              {category.image ? (
                <Image
                  src={category.image.url}
                  alt={category.image.alt ?? category.name}
                  fill
                  sizes="(min-width: 768px) 112px, 96px"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                />
              ) : (
                category.name.charAt(0).toUpperCase()
              )}
            </span>
            <span className="line-clamp-2 min-h-[2.1rem] text-center text-[13px] font-medium leading-tight text-fg">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
