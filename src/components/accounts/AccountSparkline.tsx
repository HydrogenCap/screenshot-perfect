import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface AccountSparklineProps {
  valuations: Array<{ valuation_date: string; total_value: number }>;
  className?: string;
}

export function AccountSparkline({ valuations, className }: AccountSparklineProps) {
  const data = useMemo(() => {
    if (!valuations || valuations.length === 0) return [];
    return valuations
      .sort((a, b) => a.valuation_date.localeCompare(b.valuation_date))
      .slice(-12)
      .map(v => ({ value: v.total_value }));
  }, [valuations]);

  if (data.length < 2) return null;

  const firstValue = data[0]?.value ?? 0;
  const lastValue = data[data.length - 1]?.value ?? 0;
  const isPositive = lastValue >= firstValue;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparkGrad-${isPositive ? "gain" : "loss"}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isPositive ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor={isPositive ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={isPositive ? "hsl(var(--gain))" : "hsl(var(--loss))"}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${isPositive ? "gain" : "loss"})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
