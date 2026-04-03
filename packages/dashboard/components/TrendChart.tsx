"use client";

import dynamic from "next/dynamic";
import type { TrendPoint } from "@/lib/api";

const TrendChartInner = dynamic(() => import("./TrendChartInner"), {
  ssr: false,
  loading: () => (
    <div className="h-64 animate-pulse rounded-xl bg-stone-100" />
  ),
});

interface TrendChartProps {
  data: TrendPoint[];
}

export default function TrendChart({ data }: TrendChartProps) {
  return <TrendChartInner data={data} />;
}
