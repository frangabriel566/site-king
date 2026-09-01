import Image from "next/image";
import Link from "next/link";

export function EditorialBlock({
  categoryName,
  categorySlug,
  imageUrl,
  imageAlt,
}: {
  categoryName: string;
  categorySlug: string;
  imageUrl: string | null;
  imageAlt: string;
}) {
  return (
    <section className="grid grid-cols-1 border-t border-line md:grid-cols-2">
      <div className="relative aspect-[4/3] md:aspect-auto">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col items-start justify-center gap-6 px-8 py-16 md:px-16">
        <p className="text-label">Em destaque</p>
        <h2 className="text-heading text-5xl sm:text-6xl md:text-7xl">
          {categoryName}
        </h2>
        <Link href={`/colecao?categoria=${categorySlug}`} className="link-arrow">
          Ver coleção →
        </Link>
      </div>
    </section>
  );
}
