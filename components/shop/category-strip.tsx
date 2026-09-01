import Link from "next/link";
import type { Category } from "@/lib/data/categories";

export function CategoryStrip({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
      {categories.map((category, index) => (
        <Link
          key={category.id}
          href={`/colecao?categoria=${category.slug}`}
          className={`group flex h-40 flex-col items-center justify-center gap-3 border-b border-line transition-colors duration-200 ease-out hover:bg-[#111111] md:h-56 ${
            index % 2 === 0 ? "border-r" : ""
          } md:border-r md:last:border-r-0`}
        >
          <span className="text-heading text-lg md:text-2xl">
            {category.name}
          </span>
          <span className="text-label opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
            Ver tudo →
          </span>
        </Link>
      ))}
    </div>
  );
}
