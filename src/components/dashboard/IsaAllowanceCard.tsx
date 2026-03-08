import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface IsaAllowanceCardProps {
  used: number;
  limit: number;
  taxYearLabel: string;
}

export function IsaAllowanceCard({ used, limit, taxYearLabel }: IsaAllowanceCardProps) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - used, 0);

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in col-span-full lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">ISA Allowance — Current Tax Year</h3>
        <span className="text-xs text-muted-foreground">{taxYearLabel}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span
            className={cn(
              "text-lg font-bold font-mono",
              percent >= 100 ? "text-loss" : percent >= 75 ? "text-amber-500" : "text-gain"
            )}
          >
            {formatCurrency(used)}
          </span>
          <span className="text-sm text-muted-foreground">
            of {formatCurrency(limit)}
          </span>
        </div>

        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percent >= 100 ? "bg-loss" : percent >= 75 ? "bg-amber-500" : "bg-gain"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {used > 0
            ? `${formatCurrency(remaining)} remaining`
            : "Add ISA accounts to track your allowance"}
        </p>
      </div>
    </div>
  );
}
