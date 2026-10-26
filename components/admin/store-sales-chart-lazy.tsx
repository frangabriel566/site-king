"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreSalesChartPoint } from "./store-sales-chart";

// Recharts only loads in the browser, like the main dashboard's chart.
const StoreSalesChart = dynamic(
  () => import("./store-sales-chart").then((mod) => mod.StoreSalesChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full bg-surface-2" />,
  },
);

export function StoreSalesChartLazy(props: { data: StoreSalesChartPoint[]; tickInterval: number }) {
  return <StoreSalesChart {...props} />;
}
