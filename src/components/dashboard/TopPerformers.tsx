import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Performer {
  name: string;
  ticker: string | null;
  unrealisedPL: number;
  unrealisedPLPct: number;
  currentValue: number;
}

interface TopPerformersProps {
  performers: Performer[];
}

export function TopPerformers({ performers }: TopPerformersProps) {
  if (performers.length === 0) return null;

  const sorted = [...performers].sort((a, b) => b.unrealisedPLPct - a.unrealisedPLPct);
  const gainers = sorted.filter((p) => p.unrealisedPLPct >= 0).slice(0, 3);
  const losers = [...sorted].reverse().filter((p) => p.unrealisedPLPct < 0).slice(0, 3);

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <h3 className="text-sm font-semibold mb-4">Top Performers</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {gainers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gain mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Best
            </p>
            <div className="space-y-2">
              {gainers.map((p) => (
                <PerformerRow key={p.name} performer={p} isGain />
              ))}
            </div>
          </div>
        )}
        {losers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-loss mb-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Worst
            </p>
            <div className="space-y-2">
              {losers.map((p) => (
                <PerformerRow key={p.name} performer={p} isGain={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PerformerRow({ performer: p, isGain }: { performer: Performer; isGain: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{p.name}</p>
        {p.ticker && (
          <p className="text-xs text-muted-foreground font-mono">{p.ticker}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-semibold", isGain ? "text-gain" : "text-loss")}>
          {formatPercent(p.unrealisedPLPct)}
        </p>
        <p className={cn("text-xs", isGain ? "text-gain/70" : "text-loss/70")}>
          {formatCurrency(p.unrealisedPL, "GBP", { showSign: true })}
        </p>
      </div>
    </div>
  );
}
