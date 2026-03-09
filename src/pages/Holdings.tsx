import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Package2, ArrowUpDown, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { toast } from "sonner";

interface HoldingRow {
  id: string;
  account_id: string;
  instrument_id: string | null;
  quantity: number;
  average_cost_per_unit: number;
  cost_basis: number;
  current_price: number;
  current_value: number;
  currency: string;
  last_updated: string;
  notes: string | null;
  accounts: { account_name: string; account_type: string } | null;
  instruments: { name: string; ticker: string | null; asset_class: string } | null;
}

type SortKey =
  | "name"
  | "quantity"
  | "avg_cost"
  | "cost_basis"
  | "current_value"
  | "unrealised_pl"
  | "unrealised_pl_pct";
type SortDir = "asc" | "desc";

const assetClassLabel = (v: string) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const assetClassColor: Record<string, string> = {
  equity: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  etf: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  fund: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  bond: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  gilt: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  crypto: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  cash: "bg-green-500/10 text-green-700 dark:text-green-300",
  property: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  commodity: "bg-red-500/10 text-red-700 dark:text-red-300",
  investment_trust: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  other: "bg-muted text-muted-foreground",
  alternative: "bg-muted text-muted-foreground",
};

function SortButton({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 group transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "h-3 w-3 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        )}
      />
    </button>
  );
}

export default function Holdings() {
  usePageTitle("Holdings");
  const { user } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>("current_value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ["holdings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select(
          "*, accounts(account_name, account_type), instruments(name, ticker, asset_class)"
        )
        .gt("quantity", 0);
      if (error) throw error;
      return data as HoldingRow[];
    },
    enabled: !!user,
  });

  // Aggregate per instrument across accounts
  const aggregated = useMemo(() => {
    const map = new Map<
      string,
      {
        instrumentId: string | null;
        name: string;
        ticker: string | null;
        assetClass: string;
        totalQty: number;
        totalCostBasis: number;
        totalCurrentValue: number;
        accounts: string[];
        currency: string;
      }
    >();

    holdings.forEach((h) => {
      const key = h.instrument_id ?? h.id;
      const name = h.instruments?.name ?? "Unknown";
      const existing = map.get(key);
      const accountName = h.accounts?.account_name ?? "Unknown";

      if (existing) {
        existing.totalQty += h.quantity;
        existing.totalCostBasis += h.cost_basis;
        existing.totalCurrentValue += h.current_value;
        if (!existing.accounts.includes(accountName)) {
          existing.accounts.push(accountName);
        }
      } else {
        map.set(key, {
          instrumentId: h.instrument_id,
          name,
          ticker: h.instruments?.ticker ?? null,
          assetClass: h.instruments?.asset_class ?? "other",
          totalQty: h.quantity,
          totalCostBasis: h.cost_basis,
          totalCurrentValue: h.current_value,
          accounts: [accountName],
          currency: h.currency,
        });
      }
    });

    return Array.from(map.values()).map((h) => ({
      ...h,
      avgCost: h.totalQty > 0 ? h.totalCostBasis / h.totalQty : 0,
      unrealisedPL: h.totalCurrentValue - h.totalCostBasis,
      unrealisedPLPct:
        h.totalCostBasis > 0
          ? ((h.totalCurrentValue - h.totalCostBasis) / h.totalCostBasis) * 100
          : 0,
    }));
  }, [holdings]);

  const sorted = useMemo(() => {
    return [...aggregated].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      switch (sortKey) {
        case "name":
          va = a.name;
          vb = b.name;
          break;
        case "quantity":
          va = a.totalQty;
          vb = b.totalQty;
          break;
        case "avg_cost":
          va = a.avgCost;
          vb = b.avgCost;
          break;
        case "cost_basis":
          va = a.totalCostBasis;
          vb = b.totalCostBasis;
          break;
        case "current_value":
          va = a.totalCurrentValue;
          vb = b.totalCurrentValue;
          break;
        case "unrealised_pl":
          va = a.unrealisedPL;
          vb = b.unrealisedPL;
          break;
        case "unrealised_pl_pct":
          va = a.unrealisedPLPct;
          vb = b.unrealisedPLPct;
          break;
        default:
          va = a.totalCurrentValue;
          vb = b.totalCurrentValue;
      }
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
  }, [aggregated, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const totalValue = aggregated.reduce((s, h) => s + h.totalCurrentValue, 0);
  const totalCost = aggregated.reduce((s, h) => s + h.totalCostBasis, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const handleExport = () => {
    const csvData = sorted.map((h) => ({
      Instrument: h.name,
      Ticker: h.ticker ?? "",
      "Asset Class": assetClassLabel(h.assetClass),
      Accounts: h.accounts.join("; "),
      Quantity: h.totalQty,
      "Avg Cost (£)": h.avgCost.toFixed(4),
      "Cost Basis (£)": h.totalCostBasis.toFixed(2),
      "Current Value (£)": h.totalCurrentValue.toFixed(2),
      "Unrealised P&L (£)": h.unrealisedPL.toFixed(2),
      "Unrealised P&L (%)": h.unrealisedPLPct.toFixed(2),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Holdings exported");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Holdings</h1>
          <p className="text-sm text-muted-foreground">Your current positions</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Holdings</h1>
          <p className="text-sm text-muted-foreground">
            {aggregated.length} position{aggregated.length !== 1 ? "s" : ""} across{" "}
            {new Set(holdings.map((h) => h.account_id)).size} account
            {new Set(holdings.map((h) => h.account_id)).size !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={aggregated.length === 0}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 animate-fade-in">
          <p className="text-sm font-medium text-muted-foreground">Current Value</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <p className="text-sm font-medium text-muted-foreground">Total Cost Basis</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalCost)}</p>
        </div>
        <div
          className="rounded-xl border bg-card p-5 animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-sm font-medium text-muted-foreground">Unrealised P&L</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold",
              totalPL >= 0 ? "text-gain" : "text-loss"
            )}
          >
            {formatCurrency(totalPL, "GBP", { showSign: true })}
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-medium",
              totalPL >= 0 ? "text-gain" : "text-loss"
            )}
          >
            {formatPercent(totalPLPct)} overall
          </p>
        </div>
      </div>

      {aggregated.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Package2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No holdings yet</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Add buy transactions to start tracking your positions
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">
                    <SortButton
                      label="Instrument"
                      sortKey="name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Asset Class
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="Quantity"
                      sortKey="quantity"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="Avg Cost"
                      sortKey="avg_cost"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="Cost Basis"
                      sortKey="cost_basis"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="Value"
                      sortKey="current_value"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="P&L"
                      sortKey="unrealised_pl"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    <SortButton
                      label="P&L %"
                      sortKey="unrealised_pl_pct"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h, i) => (
                  <tr
                    key={h.instrumentId ?? h.name}
                    className="border-b last:border-0 hover:bg-muted/30 animate-fade-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{h.name}</span>
                        {h.ticker && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {h.ticker}
                          </span>
                        )}
                        {h.accounts.length > 1 && (
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {h.accounts.length} accounts
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium border-0",
                          assetClassColor[h.assetClass] ?? assetClassColor.other
                        )}
                      >
                        {assetClassLabel(h.assetClass)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {h.totalQty % 1 === 0
                        ? h.totalQty.toLocaleString("en-GB")
                        : h.totalQty.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {formatCurrency(h.avgCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {formatCurrency(h.totalCostBasis)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatCurrency(h.totalCurrentValue)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-medium",
                        h.unrealisedPL >= 0 ? "text-gain" : "text-loss"
                      )}
                    >
                      <span className="flex items-center justify-end gap-1">
                        {h.unrealisedPL >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatCurrency(h.unrealisedPL, "GBP", { showSign: true })}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono",
                        h.unrealisedPLPct >= 0 ? "text-gain" : "text-loss"
                      )}
                    >
                      {formatPercent(h.unrealisedPLPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
