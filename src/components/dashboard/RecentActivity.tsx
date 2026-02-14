import { recentTransactions } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  buy: { label: "Buy", variant: "default" },
  sell: { label: "Sell", variant: "destructive" },
  dividend: { label: "Dividend", variant: "secondary" },
  interest: { label: "Interest", variant: "secondary" },
  deposit: { label: "Deposit", variant: "outline" },
  withdrawal: { label: "Withdrawal", variant: "destructive" },
};

export function RecentActivity() {
  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Recent Activity</h3>
        <p className="text-xs text-muted-foreground">Last transactions across all accounts</p>
      </div>

      <div className="space-y-1">
        {recentTransactions.map((tx) => {
          const config = typeConfig[tx.type] || { label: tx.type, variant: "outline" as const };
          const isNegative = ["sell", "withdrawal"].includes(tx.type);

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(tx.date)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {tx.instrument || tx.account}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tx.account}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={config.variant} className="text-[10px] font-medium">
                  {config.label}
                </Badge>
                <span
                  className={cn(
                    "font-mono text-sm font-medium w-24 text-right",
                    isNegative ? "text-loss" : "text-foreground"
                  )}
                >
                  {isNegative ? "-" : ""}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
