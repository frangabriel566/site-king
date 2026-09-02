import Link from "next/link";
import type { Category } from "@/lib/data/categories";

export function CategoryStrip({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="flex gap-4 overflow-x-auto px-4 pt-6 pb-4 md:px-8">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/colecao?categoria=${category.slug}`}
          className="group flex w-24 shrink-0 flex-col items-center gap-2 sm:w-28"
        >
          <span className="flex size-20 items-center justify-center rounded-full border border-gold/40 bg-surface text-xl font-bold text-gold-text transition-colors duration-150 ease-out group-hover:border-gold sm:size-24">
            {category.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-center text-xs font-medium text-fg">{category.name}</span>
        </Link>
      ))}
    </div>
  );
}
