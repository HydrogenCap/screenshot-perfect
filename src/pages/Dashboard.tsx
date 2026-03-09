import { useState, useMemo } from "react";
import { TrendingUp, PiggyBank, BarChart3, Coins, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { StatCard } from "@/components/dashboard/StatCard";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { IsaAllowanceCard } from "@/components/dashboard/IsaAllowanceCard";
import { TopPerformers } from "@/components/dashboard/TopPerformers";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

interface DHolding {
  instrument_id: string | null;
  quantity: number;
  cost_basis: number;
  current_value: number;
  instruments: { name: string; ticker: string | null } | null;
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

  const { data: holdings = [] } = useQuery({
    queryKey: ["dash-holdings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("instrument_id, quantity, cost_basis, current_value, instruments(name, ticker)")
        .gt("quantity", 0);
      if (error) throw error;
      return data as DHolding[];
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

  const isLoading = la || lv || lt;

  const computed = useMemo(() => {
    if (isLoading) return null;
    const startDate = getStartDate(dateRange);
    const activeIds = accounts.filter(a => a.is_active).map(a => a.id);

    // Latest valuation per account
    const latestMap = new Map<string, DValuation>();
    valuations.forEach(v => {
      if (!activeIds.includes(v.account_id)) return;
      const ex = latestMap.get(v.account_id);
      if (!ex || v.valuation_date > ex.valuation_date) latestMap.set(v.account_id, v);
    });
    const latestVals = Array.from(latestMap.values());
    const totalValue = latestVals.reduce((s, v) => s + v.total_value, 0);

    const deposits = transactions.filter(t => ["deposit", "contribution", "transfer_in"].includes(t.type)).reduce((s, t) => s + t.total_amount, 0);
    const withdrawals = transactions.filter(t => ["withdrawal", "transfer_out"].includes(t.type)).reduce((s, t) => s + t.total_amount, 0);
    const netContributions = deposits - withdrawals;
    const unrealisedPL = totalValue - netContributions;
    const unrealisedPLPercent = netContributions > 0 ? (unrealisedPL / netContributions) * 100 : 0;
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

    // Top performers from holdings
    const perfMap = new Map<string, { name: string; ticker: string | null; costBasis: number; currentValue: number }>();
    holdings.forEach(h => {
      const key = h.instrument_id ?? h.instruments?.name ?? "";
      if (!key) return;
      const ex = perfMap.get(key);
      if (ex) {
        ex.costBasis += h.cost_basis;
        ex.currentValue += h.current_value;
      } else {
        perfMap.set(key, {
          name: h.instruments?.name ?? "Unknown",
          ticker: h.instruments?.ticker ?? null,
          costBasis: h.cost_basis,
          currentValue: h.current_value,
        });
      }
    });
    const performers = Array.from(perfMap.values()).map(p => ({
      name: p.name,
      ticker: p.ticker,
      unrealisedPL: p.currentValue - p.costBasis,
      unrealisedPLPct: p.costBasis > 0 ? ((p.currentValue - p.costBasis) / p.costBasis) * 100 : 0,
      currentValue: p.currentValue,
    }));

    // Annualized return
    const allDates = transactions.map(t => t.transaction_date).sort();
    const firstDate = allDates[0] ? new Date(allDates[0]) : null;
    const today = new Date();
    const daysSinceStart = firstDate
      ? Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / 86400000))
      : 0;
    const annualizedReturn =
      netContributions > 0 && daysSinceStart > 0
        ? (Math.pow(totalValue / netContributions, 365 / daysSinceStart) - 1) * 100
        : null;

    return { totalValue, netContributions, unrealisedPL, unrealisedPLPercent, totalDividends, totalInterest, isaUsed, portfolioHistory, byProvider, byType, cashFlow, recent, performers, annualizedReturn, daysSinceStart };
  }, [accounts, valuations, transactions, holdings, dateRange, isLoading]);

  if (isLoading || !computed) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your portfolio at a glance</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Portfolio" value={formatCurrency(computed.totalValue)} icon={<TrendingUp className="h-4 w-4" />} delay={0} />
        <StatCard label="Net Contributions" value={formatCurrency(computed.netContributions)} icon={<PiggyBank className="h-4 w-4" />} delay={50} />
        <StatCard label="Unrealised P&L" value={formatCurrency(computed.unrealisedPL, "GBP", { showSign: true })} change={formatPercent(computed.unrealisedPLPercent)} changeType={computed.unrealisedPL >= 0 ? "gain" : "loss"} icon={<BarChart3 className="h-4 w-4" />} delay={100} />
        <StatCard label="Dividends & Interest" value={formatCurrency(computed.totalDividends + computed.totalInterest)} change={`${formatCurrency(computed.totalDividends)} dividends`} changeType="neutral" icon={<Coins className="h-4 w-4" />} delay={150} />
        {computed.annualizedReturn !== null && (
          <StatCard
            label={computed.daysSinceStart < 365 ? "Return (since start)" : "Annualised Return"}
            value={formatPercent(computed.annualizedReturn)}
            change={`Over ${Math.round(computed.daysSinceStart / 30)} months`}
            changeType={computed.annualizedReturn >= 0 ? "gain" : "loss"}
            icon={<CalendarDays className="h-4 w-4" />}
            delay={200}
          />
        )}
      </div>

      <IsaAllowanceCard used={computed.isaUsed} limit={20000} taxYearLabel={getCurrentTaxYearLabel()} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioChart data={computed.portfolioHistory} />
        <AllocationChart byProvider={computed.byProvider} byType={computed.byType} byAsset={[]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart data={computed.cashFlow} />
        <RecentActivity transactions={computed.recent} />
      </div>

      {computed.performers.length > 0 && (
        <TopPerformers performers={computed.performers} />
      )}
    </div>
  );
}
