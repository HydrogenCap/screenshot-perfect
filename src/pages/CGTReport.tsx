import { useState, useMemo, useEffect } from "react";
import { FileText, Download, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

function getTaxYear(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (month > 4 || (month === 4 && day >= 6)) {
    return `${year}/${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}/${String(year).slice(-2)}`;
}

function getTaxYearDates(ty: string) {
  const startYear = parseInt(ty.split("/")[0]);
  return { start: `${startYear}-04-06`, end: `${startYear + 1}-04-05` };
}

interface Disposal {
  id: string;
  date: string;
  instrumentName: string;
  quantity: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  fees: number;
}

interface TransactionWithInstrument {
  id: string;
  instrument_id: string | null;
  transaction_date: string;
  type: string;
  total_amount: number;
  quantity: number | null;
  fees: number;
  instruments: { name: string; ticker: string | null } | null;
}

export default function CGTReport() {
  usePageTitle("CGT Report");
  const { user } = useAuth();

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["cgt-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, instrument_id, transaction_date, type, total_amount, quantity, fees, instruments(name, ticker)")
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data as TransactionWithInstrument[];
    },
    enabled: !!user,
  });

  const taxYears = useMemo(() => {
    const years = new Set<string>();
    allTransactions.forEach(t => years.add(getTaxYear(t.transaction_date)));
    return Array.from(years).sort().reverse();
  }, [allTransactions]);

  const [selectedTaxYear, setSelectedTaxYear] = useState("");

  useEffect(() => {
    if (taxYears.length > 0 && !selectedTaxYear) {
      setSelectedTaxYear(taxYears[0]);
    }
  }, [taxYears, selectedTaxYear]);

  const disposals = useMemo<Disposal[]>(() => {
    if (!selectedTaxYear) return [];
    const { start, end } = getTaxYearDates(selectedTaxYear);

    return allTransactions
      .filter(t => t.type === "sell" && t.transaction_date >= start && t.transaction_date <= end)
      .map(sell => {
        const buys = allTransactions.filter(t =>
          t.type === "buy" &&
          t.instrument_id === sell.instrument_id &&
          t.transaction_date <= sell.transaction_date
        );
        const totalBuyQty = buys.reduce((s, t) => s + (t.quantity || 0), 0);
        const totalBuyCost = buys.reduce((s, t) => s + t.total_amount + t.fees, 0);
        const avgCost = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
        const proceeds = sell.total_amount;
        const costBasis = avgCost * (sell.quantity || 0);
        const gain = proceeds - costBasis - sell.fees;

        return {
          id: sell.id,
          date: sell.transaction_date,
          instrumentName: sell.instruments?.name || "Unknown",
          quantity: sell.quantity || 0,
          proceeds,
          costBasis,
          gain,
          fees: sell.fees,
        };
      });
  }, [allTransactions, selectedTaxYear]);

  const totalGains = disposals.filter(d => d.gain > 0).reduce((s, d) => s + d.gain, 0);
  const totalLosses = disposals.filter(d => d.gain < 0).reduce((s, d) => s + d.gain, 0);
  const netGain = totalGains + totalLosses;
  const exemptAmount = 3000;
  const remainingAllowance = Math.max(0, exemptAmount - Math.max(0, netGain));
  const taxableGain = Math.max(0, netGain - exemptAmount);

  const handleExport = () => {
    const csv = Papa.unparse(
      disposals.map(d => ({
        "Date Disposed": d.date,
        Instrument: d.instrumentName,
        "Quantity Sold": d.quantity,
        Proceeds: d.proceeds.toFixed(2),
        "Cost Basis": d.costBasis.toFixed(2),
        "Gain/Loss": d.gain.toFixed(2),
        Fees: d.fees.toFixed(2),
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cgt-report-${selectedTaxYear.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Capital Gains Tax Report</h1>
          <p className="text-sm text-muted-foreground">
            Review your disposals and estimated gains
          </p>
        </div>
        <div className="flex gap-3">
          {taxYears.length > 0 && (
            <Select value={selectedTaxYear} onValueChange={setSelectedTaxYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tax year" />
              </SelectTrigger>
              <SelectContent>
                {taxYears.map(ty => (
                  <SelectItem key={ty} value={ty}>{ty}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={handleExport} disabled={disposals.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Simplified calculation
          </p>
          <p className="text-muted-foreground mt-1">
            This report uses average cost basis. It does not implement HMRC's 30-day
            matching rule (Section 104 pool). Consult a qualified accountant for your
            tax return.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Gains" value={formatCurrency(totalGains)} changeType="gain" />
        <StatCard
          label="Total Losses"
          value={formatCurrency(Math.abs(totalLosses))}
          changeType="loss"
        />
        <StatCard
          label="Net Gain / Loss"
          value={formatCurrency(netGain, "GBP", { showSign: true })}
          changeType={netGain >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Annual Exempt Amount"
          value={formatCurrency(exemptAmount)}
          change="2024/25 allowance"
          changeType="neutral"
        />
        {taxableGain > 0 ? (
          <StatCard
            label="Taxable Gain"
            value={formatCurrency(taxableGain)}
            change="Exceeds exempt amount"
            changeType="loss"
          />
        ) : (
          <StatCard
            label="Remaining Allowance"
            value={formatCurrency(remainingAllowance)}
            change="Before CGT applies"
            changeType="gain"
          />
        )}
      </div>

      {disposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No disposals found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No sell transactions in {selectedTaxYear || "the selected tax year"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date Disposed
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Instrument
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Qty Sold
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Proceeds
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cost Basis
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Gain/Loss
                  </th>
                </tr>
              </thead>
              <tbody>
                {disposals.map((d, i) => (
                  <tr
                    key={d.id}
                    className={cn(
                      "border-b last:border-0 animate-fade-in",
                      d.gain > 0 ? "bg-gain/5" : d.gain < 0 ? "bg-loss/5" : ""
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-3">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 font-medium">{d.instrumentName}</td>
                    <td className="px-4 py-3 text-right font-mono">{d.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(d.proceeds)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(d.costBasis)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-medium",
                        d.gain >= 0 ? "text-gain" : "text-loss"
                      )}
                    >
                      {formatCurrency(d.gain, "GBP", { showSign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center py-4">
        This report is for reference only and does not constitute tax advice. Consult a
        qualified accountant.
      </p>
    </div>
  );
}
