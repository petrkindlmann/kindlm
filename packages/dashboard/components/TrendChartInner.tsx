"use client";

import type { TrendPoint } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendChartInnerProps {
  data: TrendPoint[];
}

export default function TrendChartInner({ data }: TrendChartInnerProps) {
  // Reverse so oldest is first (API returns DESC)
  const chartData = [...data].reverse().map((d) => ({
    day: d.day,
    passRate: d.avgPassRate != null ? Math.round(d.avgPassRate * 100) : null,
    costUsd: d.totalCostUsd,
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-stone-400">No trend data available.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#78716c" }} />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 12, fill: "#78716c" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            unit="$"
            tick={{ fontSize: 12, fill: "#78716c" }}
          />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="passRate"
            stroke="#6366f1"
            dot={false}
            name="Pass Rate"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costUsd"
            stroke="#84cc16"
            dot={false}
            name="Cost (USD)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
