"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts only loads in the browser, like the other panel charts.
const loading = () => <Skeleton className="h-64 w-full bg-surface-2" />;

export const VisitorsChartLazy = dynamic(
  () => import("./analytics-charts").then((mod) => mod.VisitorsChart),
  { ssr: false, loading },
);
export const SalesChartLazy = dynamic(
  () => import("./analytics-charts").then((mod) => mod.SalesChart),
  { ssr: false, loading },
);
export const ConversionChartLazy = dynamic(
  () => import("./analytics-charts").then((mod) => mod.ConversionChart),
  { ssr: false, loading },
);
export const MinutesChartLazy = dynamic(
  () => import("./analytics-charts").then((mod) => mod.MinutesChart),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full bg-surface-2" /> },
);
