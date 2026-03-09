import { useState } from "react";
import {
  Plus, Search, Download, Pencil, Trash2, Receipt,
  ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ProviderLogo } from "@/components/ProviderLogo";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

const PAGE_SIZE = 25;

interface TransactionRow {
  id: string;
  transaction_date: string;
  type: string;
  quantity: number | null;
  price_per_unit: number | null;
  total_amount: number;
  fees: number;
  notes: string | null;
  account_id: string;
  instrument_id: string | null;
  accounts: { account_name: string } | null;
  instruments: { name: string; ticker: string | null } | null;
}

const typeBadge: Record<string, { label: string; className: string }> = {
  buy: { label: "Buy", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  sell: { label: "Sell", className: "bg-loss/10 text-loss" },
  dividend: { label: "Dividend", className: "bg-gain/10 text-gain" },
  interest: { label: "Interest", className: "bg-gain/10 text-gain" },
  deposit: { label: "Deposit", className: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  withdrawal: { label: "Withdrawal", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  fee: { label: "Fee", className: "bg-muted text-muted-foreground" },
  transfer_in: { label: "Transfer In", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  transfer_out: { label: "Transfer Out", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  contribution: { label: "Contribution", className: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  tax_relief: { label: "Tax Relief", className: "bg-gain/10 text-gain" },
  corporate_action: { label: "Corp. Action", className: "bg-muted text-muted-foreground" },
  stock_split: { label: "Stock Split", className: "bg-muted text-muted-foreground" },
  fx_conversion: { label: "FX Conversion", className: "bg-muted text-muted-foreground" },
  other: { label: "Other", className: "bg-muted text-muted-foreground" },
};

export default function Transactions() {
  usePageTitle("Transactions");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["tx-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, providers(name, logo_url)");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: instruments = [] } = useQuery({
    queryKey: ["tx-instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("id, name, ticker");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: txResult, isLoading } = useQuery({
    queryKey: ["transactions", page, search, dateFrom, dateTo, selectedAccounts, selectedTypes],
    queryFn: async () => {
      // Find instrument IDs matching the search term (by name or ticker)
      let matchingInstrumentIds: string[] = [];
      if (search) {
        const term = search.toLowerCase();
        matchingInstrumentIds = (instruments as { id: string; name: string; ticker: string | null }[])
          .filter(
            (i) =>
              i.name.toLowerCase().includes(term) ||
              (i.ticker && i.ticker.toLowerCase().includes(term))
          )
          .map((i) => i.id);
      }

      let query = supabase
        .from("transactions")
        .select("*, accounts(account_name), instruments(name, ticker)", { count: "exact" })
        .order("transaction_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFrom) query = query.gte("transaction_date", dateFrom);
      if (dateTo) query = query.lte("transaction_date", dateTo);
      if (selectedAccounts.length > 0) query = query.in("account_id", selectedAccounts);
      if (selectedTypes.length > 0) query = query.in("type", selectedTypes as unknown as readonly Database["public"]["Enums"]["transaction_type"][]);
      if (search) {
        const noteFilter = `notes.ilike.%${search}%`;
        if (matchingInstrumentIds.length > 0) {
          query = query.or(`${noteFilter},instrument_id.in.(${matchingInstrumentIds.join(",")})`);
        } else {
          query = query.ilike("notes", `%${search}%`);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data || []) as TransactionRow[], total: count || 0 };
    },
    enabled: !!user,
  });

  const transactions = txResult?.rows || [];
  const totalCount = txResult?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction deleted");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleExport = () => {
    const csvData = transactions.map(t => ({
      Date: t.transaction_date,
      Account: t.accounts?.account_name || "",
      Type: t.type,
      Instrument: t.instruments?.name || "",
      Ticker: t.instruments?.ticker || "",
      Quantity: t.quantity ?? "",
      Price: t.price_per_unit ?? "",
      Amount: t.total_amount,
      Fees: t.fees,
      Notes: t.notes || "",
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleFilter = (
    value: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
    setPage(0);
  };

  const typeLabel = (t: string) =>
    typeBadge[t]?.label || t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} transaction{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setEditingTx(null); setSheetOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search instrument, ticker, notes..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Input
          type="date"
          className="w-[150px]"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(0); }}
        />
        <Input
          type="date"
          className="w-[150px]"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(0); }}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Account {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 max-h-60 overflow-y-auto">
            {accounts.map((a: any) => (
              <label
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedAccounts.includes(a.id)}
                  onCheckedChange={() => toggleFilter(a.id, selectedAccounts, setSelectedAccounts)}
                />
                {a.providers?.name && (
                  <ProviderLogo name={a.providers.name} logoUrl={a.providers.logo_url} size="xs" />
                )}
                <span className="truncate">{a.providers?.name} — {a.account_name}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 max-h-60 overflow-y-auto">
            {Object.entries(typeBadge).map(([key, config]) => (
              <label
                key={key}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedTypes.includes(key)}
                  onCheckedChange={() => toggleFilter(key, selectedTypes, setSelectedTypes)}
                />
                {config.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={transactions.length === 0}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Table or Empty state */}
      {!isLoading && transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Receipt className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No transactions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Import a CSV or add one manually to get started
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" asChild>
              <a href="/import">Import CSV</a>
            </Button>
            <Button onClick={() => { setEditingTx(null); setSheetOpen(true); }}>
              Add Transaction
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Instrument</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fees</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const badge = typeBadge[tx.type] || {
                    label: typeLabel(tx.type),
                    className: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr
                      key={tx.id}
                      className="border-b last:border-0 hover:bg-muted/30 animate-fade-in"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-3">{tx.accounts?.account_name || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium border-0", badge.className)}
                        >
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{tx.instruments?.name || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {tx.quantity != null ? tx.quantity : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {tx.price_per_unit != null ? formatCurrency(tx.price_per_unit) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {formatCurrency(tx.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {tx.fees > 0 ? formatCurrency(tx.fees) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingTx(tx); setSheetOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => { setDeletingId(tx.id); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accounts={accounts}
        instruments={instruments}
        editData={editingTx}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          setEditingTx(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
