import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { portfolioHistory } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const periods = ["3M", "6M", "YTD", "1Y", "ALL"] as const;

export function PortfolioChart() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("ALL");

  const filteredData = (() => {
    const now = portfolioHistory.length;
    switch (period) {
      case "3M": return portfolioHistory.slice(-3);
      case "6M": return portfolioHistory.slice(-6);
      case "YTD": return portfolioHistory.slice(-1);
      case "1Y": return portfolioHistory.slice(-12);
      default: return portfolioHistory;
    }
  })();

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Portfolio Value</h3>
          <p className="text-xs text-muted-foreground">Value vs. contributions over time</p>
        </div>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={filteredData}>
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
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "value" ? "Portfolio Value" : "Contributions",
            ]}
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
    </div>
  );
}
