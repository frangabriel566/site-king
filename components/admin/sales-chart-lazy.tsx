"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SalesChart = dynamic(
  () => import("./sales-chart").then((mod) => mod.SalesChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-none bg-[#161616]" />,
  },
);

export function SalesChartLazy({ data }: { data: { date: string; total: number }[] }) {
  return <SalesChart data={data} />;
}
