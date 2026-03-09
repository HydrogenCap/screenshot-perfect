import { BarChart3, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountTypeLabels } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountSparkline } from "./AccountSparkline";

interface AccountCardProps {
  account: {
    id: string;
    account_name: string;
    account_type: string;
    is_active: boolean;
    providers?: { name: string } | null;
    latestValuation?: {
      total_value: number;
      cash_balance: number;
      invested_value: number;
    } | null;
  };
  valuations?: Array<{ valuation_date: string; total_value: number }>;
  onEditBalance: () => void;
  onEdit: () => void;
}

export function AccountCard({ account, valuations = [], onEditBalance, onEdit }: AccountCardProps) {
  const v = account.latestValuation;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">
            {account.providers?.name}
          </p>
          <h3 className="font-semibold truncate">{account.account_name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full shrink-0",
              account.is_active ? "bg-gain" : "bg-muted-foreground"
            )}
          />
          <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
            {accountTypeLabels[account.account_type] || account.account_type}
          </Badge>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-2xl font-bold font-mono">
            {v ? formatCurrency(v.total_value) : "—"}
          </p>
          {v && (
            <p className="text-xs text-muted-foreground">
              <span className="text-muted-foreground/70">Cash:</span>{" "}
              {formatCurrency(v.cash_balance)}
              <span className="mx-1.5">·</span>
              <span className="text-muted-foreground/70">Invested:</span>{" "}
              {formatCurrency(v.invested_value)}
            </p>
          )}
        </div>
        {valuations.length >= 2 && (
          <AccountSparkline valuations={valuations} className="h-10 w-20 shrink-0" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onEditBalance}>
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          {v ? "Edit Balance" : "Add Balance"}
        </Button>
      </div>
    </div>
  );
}
