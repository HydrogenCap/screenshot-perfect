import { useState, useMemo } from "react";
import { TrendingUp, PiggyBank, BarChart3, Coins, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePortfolioHoldings, useRefreshPrices } from "@/hooks/usePortfolioHoldings";
import { StatCard } from "@/components/dashboard/StatCard";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { IsaAllowanceCard } from "@/components/dashboard/IsaAllowanceCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(262, 83%, 58%)",
  "hsl(31, 97%, 62%)", "hsl(196, 94%, 67%)", "hsl(349, 89%, 60%)",
];

const DATE_RANGE_OPTIONS = [
  { label: "Last 30 days", value: "30d" },
  { label: "Last 3 months", value: "3m" },
  { label: "Last 6 months", value: "6m" },
  { label: "Last 12 months", value: "12m" },
  { label: "This tax year", value: "tax" },
  { label: "All time", value: "all" },
];

function getStartDate(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }
    case "3m": { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
    case "6m": { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); }
    case "12m": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); }
    case "tax": {
      const y = now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6) ? now.getFullYear() : now.getFullYear() - 1;
      return `${y}-04-06`;
    }
    default: return null;
  }
}

function getCurrentTaxYearLabel(): string {
  const now = new Date();
  const y = now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6) ? now.getFullYear() : now.getFullYear() - 1;
  return `6 Apr ${y} – 5 Apr ${y + 1}`;
}

function getCurrentTaxYearStart(): string {
  const now = new Date();
  const y = now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6) ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-06`;
}

interface DAccount {
  id: string;
  account_name: string;
  account_type: string;
  provider_id: string;
  is_active: boolean;
  providers: { name: string } | null;
}

interface DValuation {
  account_id: string;
  valuation_date: string;
  total_value: number;
  cash_balance: number;
  invested_value: number;
}

interface DTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  type: string;
  total_amount: number;
  instruments: { name: string } | null;
  accounts: { account_name: string } | null;
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("all");

  const { data: holdings = [], isLoading: lh } = usePortfolioHoldings();
  const refreshPrices = useRefreshPrices();

  const { data: accounts = [], isLoading: la } = useQuery({
    queryKey: ["dash-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, provider_id, is_active, providers(name)");
      if (error) throw error;
      return data as DAccount[];
    },
    enabled: !!user,
  });

  const { data: valuations = [], isLoading: lv } = useQuery({
    queryKey: ["dash-valuations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("valuations")
        .select("account_id, valuation_date, total_value, cash_balance, invested_value")
        .order("valuation_date", { ascending: true });
      if (error) throw error;
      return data as DValuation[];
    },
    enabled: !!user,
  });

  const { data: transactions = [], isLoading: lt } = useQuery({
    queryKey: ["dash-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, account_id, transaction_date, type, total_amount, instruments(name), accounts(account_name)")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as DTransaction[];
    },
    enabled: !!user,
  });

  const isLoading = la || lv || lt || lh;

  // Holdings-based valuations
  const holdingsTotal = useMemo(() => {
    const totalMarketValue = holdings.reduce((s, h) => s + h.market_value, 0);
    const totalCost = holdings.reduce((s, h) => s + h.total_cost, 0);
    const totalGainLoss = totalMarketValue - totalCost;
    const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
    const holdingsCount = holdings.length;
    const hasPrices = holdings.some(h => h.current_price != null);
    return { totalMarketValue, totalCost, totalGainLoss, totalGainLossPct, holdingsCount, hasPrices };
  }, [holdings]);

  const handleRefreshPrices = () => {
    const tickers = holdings
      .map(h => h.ticker)
      .filter((t): t is string => !!t);
    const unique = [...new Set(tickers)];
    if (unique.length === 0) {
      toast.info("No tickers to refresh");
      return;
    }
    refreshPrices.mutate(unique, {
      onSuccess: (data) => {
        toast.success(`Prices updated for ${data.updated} instruments`);
        if (data.errors.length > 0) {
          toast.warning(`${data.errors.length} ticker(s) failed to fetch`);
        }
      },
      onError: (err: any) => toast.error(err.message || "Failed to refresh prices"),
    });
  };

  const computed = useMemo(() => {
    if (isLoading) return null;
    const startDate = getStartDate(dateRange);
    const activeIds = accounts.filter(a => a.is_active).map(a => a.id);

    // Use holdings-based total if available, otherwise fall back to valuations
    const latestMap = new Map<string, DValuation>();
    valuations.forEach(v => {
      if (!activeIds.includes(v.account_id)) return;
      const ex = latestMap.get(v.account_id);
      if (!ex || v.valuation_date > ex.valuation_date) latestMap.set(v.account_id, v);
    });
    const latestVals = Array.from(latestMap.values());
    const valuationTotal = latestVals.reduce((s, v) => s + v.total_value, 0);
    const totalValue = holdingsTotal.hasPrices ? holdingsTotal.totalMarketValue : valuationTotal;

    const deposits = transactions.filter(t => ["deposit", "contribution", "transfer_in"].includes(t.type)).reduce((s, t) => s + t.total_amount, 0);
    const withdrawals = transactions.filter(t => ["withdrawal", "transfer_out"].includes(t.type)).reduce((s, t) => s + t.total_amount, 0);
    const netContributions = deposits - withdrawals;
    const unrealisedPL = holdingsTotal.hasPrices ? holdingsTotal.totalGainLoss : (totalValue - netContributions);
    const unrealisedPLPercent = holdingsTotal.hasPrices ? holdingsTotal.totalGainLossPct : (netContributions > 0 ? (unrealisedPL / netContributions) * 100 : 0);
    const totalDividends = transactions.filter(t => t.type === "dividend").reduce((s, t) => s + t.total_amount, 0);
    const totalInterest = transactions.filter(t => t.type === "interest").reduce((s, t) => s + t.total_amount, 0);

    // ISA
    const isaIds = accounts.filter(a => ["stocks_and_shares_isa", "cash_isa", "lifetime_isa"].includes(a.account_type)).map(a => a.id);
    const tyStart = getCurrentTaxYearStart();
    const isaUsed = transactions.filter(t => isaIds.includes(t.account_id) && ["deposit", "contribution"].includes(t.type) && t.transaction_date >= tyStart).reduce((s, t) => s + t.total_amount, 0);

    // Portfolio history
    const filteredVals = startDate ? valuations.filter(v => v.valuation_date >= startDate && activeIds.includes(v.account_id)) : valuations.filter(v => activeIds.includes(v.account_id));
    const byDate = new Map<string, number>();
    filteredVals.forEach(v => byDate.set(v.valuation_date, (byDate.get(v.valuation_date) || 0) + v.total_value));
    const dates = Array.from(byDate.keys()).sort();
    const contribTxs = transactions.filter(t => ["deposit", "contribution", "transfer_in"].includes(t.type));
    const withdrawTxs = transactions.filter(t => ["withdrawal", "transfer_out"].includes(t.type));
    const portfolioHistory = dates.map(date => ({
      date,
      value: byDate.get(date) || 0,
      contributions: contribTxs.filter(t => t.transaction_date <= date).reduce((s, t) => s + t.total_amount, 0) - withdrawTxs.filter(t => t.transaction_date <= date).reduce((s, t) => s + t.total_amount, 0),
    }));

    // Allocation
    const provMap = new Map<string, { name: string; value: number }>();
    latestVals.forEach(v => {
      const acc = accounts.find(a => a.id === v.account_id);
      const name = acc?.providers?.name || "Unknown";
      const cur = provMap.get(name) || { name, value: 0 };
      cur.value += v.total_value;
      provMap.set(name, cur);
    });
    const byProvider = Array.from(provMap.values()).map((it, i) => ({ ...it, color: CHART_COLORS[i % CHART_COLORS.length] }));

    const typeMap = new Map<string, { name: string; value: number }>();
    latestVals.forEach(v => {
      const acc = accounts.find(a => a.id === v.account_id);
      const name = acc?.account_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Other";
      const cur = typeMap.get(name) || { name, value: 0 };
      cur.value += v.total_value;
      typeMap.set(name, cur);
    });
    const byType = Array.from(typeMap.values()).map((it, i) => ({ ...it, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Cash flow
    const filteredTx = startDate ? transactions.filter(t => t.transaction_date >= startDate) : transactions;
    const cfMap = new Map<string, { deposits: number; withdrawals: number }>();
    filteredTx.forEach(t => {
      const month = t.transaction_date.slice(0, 7);
      const cur = cfMap.get(month) || { deposits: 0, withdrawals: 0 };
      if (["deposit", "contribution", "transfer_in", "dividend", "interest"].includes(t.type)) cur.deposits += t.total_amount;
      else if (["withdrawal", "transfer_out", "fee"].includes(t.type)) cur.withdrawals += t.total_amount;
      cfMap.set(month, cur);
    });
    const cashFlow = Array.from(cfMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([m, d]) => ({
      month: new Date(m + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      ...d,
    }));

    // Recent
    const recent = transactions.slice(0, 10).map(t => ({
      id: t.id, date: t.transaction_date,
      account: t.accounts?.account_name || "Unknown",
      type: t.type, instrument: t.instruments?.name || null,
      amount: t.total_amount,
    }));

    return { totalValue, netContributions, unrealisedPL, unrealisedPLPercent, totalDividends, totalInterest, isaUsed, portfolioHistory, byProvider, byType, cashFlow, recent };
  }, [accounts, valuations, transactions, dateRange, isLoading, holdingsTotal]);

  if (isLoading || !computed) return <DashboardSkeleton />;

  // Sort holdings by market value desc for the table
  const sortedHoldings = [...holdings].sort((a, b) => b.market_value - a.market_value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your portfolio at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshPrices}
            disabled={refreshPrices.isPending || holdings.length === 0}
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", refreshPrices.isPending && "animate-spin")} />
            {refreshPrices.isPending ? "Refreshing…" : "Refresh Prices"}
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Portfolio" value={formatCurrency(computed.totalValue)} icon={<TrendingUp className="h-4 w-4" />} delay={0} />
        <StatCard
          label={holdingsTotal.hasPrices ? "Total Cost Basis" : "Net Contributions"}
          value={formatCurrency(holdingsTotal.hasPrices ? holdingsTotal.totalCost : computed.netContributions)}
          icon={<PiggyBank className="h-4 w-4" />}
          delay={50}
        />
        <StatCard
          label="Unrealised P&L"
          value={computed.totalValue === 0 && computed.netContributions > 0 ? "N/A" : formatCurrency(computed.unrealisedPL, "GBP", { showSign: true })}
          change={computed.totalValue === 0 && computed.netContributions > 0 ? "No valuation data" : formatPercent(computed.unrealisedPLPercent)}
          changeType={computed.totalValue === 0 && computed.netContributions > 0 ? "neutral" : computed.unrealisedPL >= 0 ? "gain" : "loss"}
          icon={<BarChart3 className="h-4 w-4" />}
          delay={100}
        />
        <StatCard
          label={holdingsTotal.hasPrices ? "Active Positions" : "Dividends & Interest"}
          value={holdingsTotal.hasPrices ? String(holdingsTotal.holdingsCount) : formatCurrency(computed.totalDividends + computed.totalInterest)}
          change={holdingsTotal.hasPrices ? `${formatCurrency(computed.totalDividends)} dividends` : `${formatCurrency(computed.totalDividends)} dividends`}
          changeType="neutral"
          icon={<Coins className="h-4 w-4" />}
          delay={150}
        />
      </div>

      <IsaAllowanceCard used={computed.isaUsed} limit={20000} taxYearLabel={getCurrentTaxYearLabel()} />

      {/* Holdings breakdown table */}
      {sortedHoldings.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Holdings Breakdown</h3>
            <span className="text-xs text-muted-foreground">{sortedHoldings.length} positions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Instrument</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Ticker</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Account</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Avg Cost</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Price</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Value</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((h, i) => (
                  <tr key={`${h.instrument_id}-${h.account_id}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium truncate max-w-[200px]">{h.instrument_name || "—"}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground text-xs">{h.ticker || "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{h.account_name}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{h.net_quantity.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{formatCurrency(h.avg_cost)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {h.current_price != null ? formatCurrency(h.current_price) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-medium">
                      {h.current_price != null ? formatCurrency(h.market_value) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className={cn("px-4 py-2 text-right font-mono tabular-nums", h.gain_loss > 0 ? "text-gain" : h.gain_loss < 0 ? "text-loss" : "text-muted-foreground")}>
                      {h.current_price != null ? (
                        <div>
                          <div>{formatCurrency(h.gain_loss, "GBP", { showSign: true })}</div>
                          <div className="text-[10px]">{formatPercent(h.gain_loss_pct)}</div>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioChart data={computed.portfolioHistory} />
        <AllocationChart byProvider={computed.byProvider} byType={computed.byType} byAsset={[]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart data={computed.cashFlow} />
        <RecentActivity transactions={computed.recent} />
      </div>
    </div>
  );
}
