import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlyCashFlow } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export function CashFlowChart() {
  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Monthly Cash Flow</h3>
        <p className="text-xs text-muted-foreground">Deposits vs withdrawals</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthlyCashFlow} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `£${v}`}
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
              name === "deposits" ? "Deposits" : "Withdrawals",
            ]}
          />
          <Bar dataKey="deposits" fill="hsl(var(--gain))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="withdrawals" fill="hsl(var(--loss))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
