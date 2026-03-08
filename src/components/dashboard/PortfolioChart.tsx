import {
  Area, AreaChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";

interface PortfolioChartProps {
  data: { date: string; value: number; contributions: number }[];
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Portfolio Value</h3>
        <p className="text-xs text-muted-foreground">Value vs. net contributions over time</p>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
          No valuation data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="contribGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(label: string) => formatDate(label)}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === "value" ? "Portfolio Value" : "Net Contributions",
              ]}
            />
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value: string) =>
                value === "value" ? "Portfolio Value" : "Net Contributions"
              }
            />
            <Area
              type="monotone"
              dataKey="contributions"
              stroke="hsl(var(--chart-2))"
              fill="url(#contribGradient)"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              fill="url(#valueGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
