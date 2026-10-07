import { ProductRailSkeleton, SkeletonBlock } from "@/components/shop/skeletons";

/** The home while its rails load: banner, category circles, two rails —
 * the same boxes the page draws, so it settles in place. */
export default function HomeLoading() {
  return (
    <div aria-busy="true">
      <SkeletonBlock className="aspect-[12/5] w-full rounded-none" />
      <div className="mx-auto flex max-w-[1400px] gap-4 overflow-hidden px-4 pt-6 pb-4 md:justify-center md:px-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-24 shrink-0 flex-col items-center gap-3 md:w-28">
            <SkeletonBlock className="size-24 rounded-full md:size-28" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
      <ProductRailSkeleton />
      <ProductRailSkeleton />
    </div>
  );
}
