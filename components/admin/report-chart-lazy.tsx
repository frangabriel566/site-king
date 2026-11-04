"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportChartPoint } from "./report-chart";

// Recharts only loads in the browser, like the other panel charts.
const ReportChart = dynamic(() => import("./report-chart").then((mod) => mod.ReportChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full bg-surface-2" />,
});

export function ReportChartLazy(props: { data: ReportChartPoint[]; series: ("site" | "loja")[] }) {
  return <ReportChart {...props} />;
}
