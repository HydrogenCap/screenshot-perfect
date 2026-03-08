import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

interface AllocationChartProps {
  byProvider: AllocationItem[];
  byType: AllocationItem[];
  byAsset: AllocationItem[];
}

const viewLabels = {
  provider: "By Provider",
  type: "By Account Type",
  asset: "By Asset Class",
} as const;

type ViewKey = keyof typeof viewLabels;

export function AllocationChart({ byProvider, byType, byAsset }: AllocationChartProps) {
  const [view, setView] = useState<ViewKey>("provider");

  const dataMap: Record<ViewKey, AllocationItem[]> = {
    provider: byProvider,
    type: byType,
    asset: byAsset,
  };

  const data = dataMap[view];
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Allocation</h3>
        <div className="flex gap-1">
          {(Object.keys(viewLabels) as ViewKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {viewLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
          No allocation data
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex-1 space-y-2">
            {data.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium font-mono text-xs">
                    {total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                  <span className="font-mono text-xs text-muted-foreground w-20 text-right">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
