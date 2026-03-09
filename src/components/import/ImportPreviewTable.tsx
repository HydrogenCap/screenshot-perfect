import { CanonicalTransaction } from "@/lib/brokerMappings";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  buy: "bg-gain/15 text-gain",
  sell: "bg-loss/15 text-loss",
  dividend: "bg-primary/15 text-primary",
  interest: "bg-primary/15 text-primary",
  deposit: "bg-muted text-muted-foreground",
  withdrawal: "bg-muted text-muted-foreground",
  fee: "bg-loss/15 text-loss",
  other: "bg-muted text-muted-foreground",
};

interface ImportPreviewTableProps {
  transactions: CanonicalTransaction[];
  maxRows?: number;
}

export default function ImportPreviewTable({ transactions, maxRows = 100 }: ImportPreviewTableProps) {
  const displayed = transactions.slice(0, maxRows);

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Instrument</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Ticker</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Qty</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Price</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Net (GBP)</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Fees</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((txn, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2 whitespace-nowrap">{txn.tradeDate}</td>
                <td className="p-2">
                  <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase", TYPE_COLORS[txn.type])}>
                    {txn.type}
                  </span>
                </td>
                <td className="p-2 truncate max-w-[200px]">{txn.instrument || "—"}</td>
                <td className="p-2 font-mono text-muted-foreground">{txn.ticker || "—"}</td>
                <td className="p-2 text-right tabular-nums">{txn.quantity?.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{txn.price != null ? formatCurrency(txn.price) : "—"}</td>
                <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(txn.netAmountGbp)}</td>
                <td className="p-2 text-right tabular-nums">{txn.fees > 0 ? formatCurrency(txn.fees) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transactions.length > maxRows && (
        <div className="border-t bg-muted/30 p-2 text-center text-xs text-muted-foreground">
          Showing {maxRows} of {transactions.length} transactions
        </div>
      )}
    </div>
  );
}
