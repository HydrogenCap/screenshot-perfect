import { TrendingUp, PiggyBank, BarChart3, Coins } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { portfolioStats } from "@/lib/mock-data";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function Dashboard() {
  const s = portfolioStats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your portfolio at a glance</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Portfolio"
          value={formatCurrency(s.totalValue)}
          icon={<TrendingUp className="h-4 w-4" />}
          delay={0}
        />
        <StatCard
          label="Net Contributions"
          value={formatCurrency(s.netContributions)}
          icon={<PiggyBank className="h-4 w-4" />}
          delay={50}
        />
        <StatCard
          label="Unrealised P&L"
          value={formatCurrency(s.unrealisedPL, "GBP", { showSign: true })}
          change={formatPercent(s.unrealisedPLPercent)}
          changeType="gain"
          icon={<BarChart3 className="h-4 w-4" />}
          delay={100}
        />
        <StatCard
          label="Dividends & Interest"
          value={formatCurrency(s.totalDividends + s.totalInterest)}
          change={`${formatCurrency(s.totalDividends)} dividends`}
          changeType="neutral"
          icon={<Coins className="h-4 w-4" />}
          delay={150}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioChart />
        <AllocationChart />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart />
        <RecentActivity />
      </div>
    </div>
  );
}
