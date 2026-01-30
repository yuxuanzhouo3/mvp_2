"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type RevenueChartPoint = {
  date: string;
  revenue: number;
  paidCount: number;
};

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  return (
    <ChartContainer
      config={{
        revenue: { label: "收入", color: "hsl(var(--chart-1))" },
        paidCount: { label: "支付数", color: "hsl(var(--chart-2))" },
      }}
      className="w-full h-[260px]"
    >
      <LineChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="paidCount"
          stroke="var(--color-paidCount)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

