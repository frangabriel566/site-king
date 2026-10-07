/**
 * Loading placeholders shaped like the real thing — the same boxes, the
 * same gaps, the same widths as ProductCard / ProductRail / ProductGrid —
 * so when the content lands nothing below it moves. Server components:
 * no JavaScript, just markup that pulses (and holds still for anyone who
 * asked for reduced motion).
 */

const block = "animate-pulse rounded bg-surface-2 motion-reduce:animate-none";

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-lg border border-line bg-white">
      <div className={`aspect-[3/4] ${block} rounded-none`} />
      <div className="flex flex-col gap-2 p-3">
        <div className={`h-3 w-1/3 ${block}`} />
        <div className={`h-4 w-5/6 ${block}`} />
        <div className={`h-4 w-2/3 ${block}`} />
        <div className={`mt-1 h-6 w-1/2 ${block}`} />
        <div className={`h-3 w-3/4 ${block}`} />
      </div>
    </div>
  );
}

/** A rail's worth: the title row and the first cards, at the rail's own
 * card widths. `title` keeps the real heading on screen while the cards
 * load, so the rail doesn't change shape when they arrive. */
export function ProductRailSkeleton({ title, cards = 4 }: { title?: string; cards?: number }) {
  return (
    <section
      aria-busy="true"
      aria-label={title ? `${title} (carregando)` : "Carregando produtos"}
      className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8"
    >
      <div className="mb-4 flex h-8 items-center">
        {title ? (
          <h2 className="text-xl font-bold text-fg md:text-2xl">{title}</h2>
        ) : (
          <div className={`h-6 w-40 ${block}`} />
        )}
      </div>
      <div className="flex gap-4 overflow-hidden pb-2">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="w-[45vw] shrink-0 sm:w-56 lg:w-64">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando produtos" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: cards }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${block} ${className}`} />;
}
