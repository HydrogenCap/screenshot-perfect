import { useRef, useState } from "react";
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Papa from "papaparse";
import {
  ParsedTransaction,
  ProviderFormat,
  detectProvider,
  parseRows,
  providerLabel,
  preprocessCSV,
} from "@/lib/csv-parsers";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type ImportStep = "upload" | "preview" | "importing" | "done";

export default function Import() {
  usePageTitle("Import CSV");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<ProviderFormat>("unknown");
  const [parsedTxns, setParsedTxns] = useState<ParsedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, providers:provider_id(name)")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawText = ev.target?.result as string;
      const cleanedText = preprocessCSV(rawText);

      Papa.parse(cleanedText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          if (rows.length === 0) {
            toast.error("CSV file is empty");
            return;
          }

          const headers = Object.keys(rows[0]);
          const provider = detectProvider(headers);
          setDetectedProvider(provider);

          if (provider === "unknown") {
            toast.error("Could not detect CSV format. Supported: Trading212, Freetrade, Fidelity");
            return;
          }

          const txns = parseRows(rows, provider);
          setParsedTxns(txns);
          setStep("preview");
          toast.success(`Detected ${providerLabel(provider)} — ${txns.length} transactions parsed`);
        },
        error: (err: any) => {
          toast.error(`Error parsing CSV: ${err.message}`);
        },
      });
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAccountId || parsedTxns.length === 0) {
        throw new Error("Missing account or transactions");
      }

      setStep("importing");

      // Create import record
      const { data: importRecord, error: importErr } = await supabase
        .from("imports")
        .insert({
          account_id: selectedAccountId,
          filename: csvFile!.name,
          file_size: csvFile!.size,
          row_count: parsedTxns.length,
          status: "previewing" as any,
        })
        .select("id")
        .single();
      if (importErr) throw importErr;

      // Ensure instruments exist (find or create by ISIN/name)
      const instrumentCache: Record<string, string> = {};
      for (const txn of parsedTxns) {
        if (!txn.isin && !txn.name) continue;
        if (txn.type === "deposit" || txn.type === "withdrawal" || txn.type === "interest") continue;

        const cacheKey = txn.isin || txn.name || "";
        if (instrumentCache[cacheKey]) continue;

        // Try find existing
        let query = supabase.from("instruments").select("id").eq("user_id", user.id);
        if (txn.isin) query = query.eq("isin", txn.isin);
        else if (txn.name) query = query.eq("name", txn.name);

        const { data: existing } = await query.maybeSingle();
        if (existing) {
          instrumentCache[cacheKey] = existing.id;
        } else {
          const { data: newInst, error: instErr } = await supabase
            .from("instruments")
            .insert({
              user_id: user.id,
              name: txn.name || txn.ticker || txn.isin || "Unknown",
              ticker: txn.ticker,
              isin: txn.isin,
              currency: txn.currency,
            })
            .select("id")
            .single();
          if (instErr) throw instErr;
          instrumentCache[cacheKey] = newInst.id;
        }
      }

      // Insert transactions in batches
      let imported = 0;
      let skipped = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < parsedTxns.length; i += BATCH_SIZE) {
        const batch = parsedTxns.slice(i, i + BATCH_SIZE);
        const rows = batch.map((txn) => {
          const cacheKey = txn.isin || txn.name || "";
          const instrumentId = instrumentCache[cacheKey] || null;
          const needsInstrument = !["deposit", "withdrawal", "interest"].includes(txn.type);

          return {
            account_id: selectedAccountId,
            transaction_date: txn.date,
            type: txn.type as any,
            quantity: txn.quantity,
            price_per_unit: txn.pricePerUnit,
            total_amount: txn.totalAmount,
            fees: txn.fees,
            currency: txn.currency,
            fx_rate: txn.fxRate,
            instrument_id: needsInstrument ? instrumentId : null,
            import_id: importRecord.id,
            notes: txn.notes,
          };
        });

        const { error: txnErr, data } = await supabase
          .from("transactions")
          .insert(rows)
          .select("id");

        if (txnErr) {
          console.error("Batch insert error:", txnErr);
          skipped += batch.length;
        } else {
          imported += (data?.length || 0);
        }
      }

      // Update import record
      await supabase
        .from("imports")
        .update({
          status: "confirmed" as any,
          imported_count: imported,
          skipped_count: skipped,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);

      return { imported, skipped };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-value"] });
      toast.success(`Imported ${result.imported} transactions`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Import failed");
      setStep("preview");
    },
  });

  const clearFile = () => {
    setCsvFile(null);
    setParsedTxns([]);
    setDetectedProvider("unknown");
    setSelectedAccountId("");
    setImportResult(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const typeCounts = parsedTxns.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload transaction data from your providers
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Step: Upload */}
      {step === "upload" && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center rounded-xl border-2 border-dashed bg-card p-16 transition-colors hover:border-primary/50 cursor-pointer"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Drop your CSV file here</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supports Trading212, Freetrade and more
                </p>
              </div>
              <Button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <FileText className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
            </div>
          </button>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Supported Providers</h3>
            <div className="flex flex-wrap gap-2">
              {["Trading212", "Freetrade", "Fidelity"].map((provider) => (
                <span
                  key={provider}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{csvFile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {providerLabel(detectedProvider)} · {parsedTxns.length} transactions
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Transaction summary badges */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <Badge key={type} variant="outline" className={cn("text-xs", TYPE_COLORS[type])}>
                {type} ({count})
              </Badge>
            ))}
          </div>

          {/* Account selector */}
          <div className="space-y-2">
            <Label>Import into account</Label>
            {accounts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No accounts found. Please add an account first.
              </div>
            ) : (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {(acc.providers as any)?.name} — {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview table */}
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTxns.slice(0, 100).map((txn, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{txn.date}</td>
                      <td className="p-2">
                        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", TYPE_COLORS[txn.type])}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="p-2 truncate max-w-[200px]">{txn.name || txn.ticker || "—"}</td>
                      <td className="p-2 text-right tabular-nums">{txn.quantity?.toFixed(2) ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{txn.pricePerUnit != null ? formatCurrency(txn.pricePerUnit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(txn.totalAmount)}</td>
                      <td className="p-2 text-right tabular-nums">{txn.fees > 0 ? formatCurrency(txn.fees) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedTxns.length > 100 && (
              <div className="border-t bg-muted/30 p-2 text-center text-xs text-muted-foreground">
                Showing 100 of {parsedTxns.length} transactions
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!selectedAccountId || parsedTxns.length === 0}
            >
              Import {parsedTxns.length} transactions
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium">Importing transactions...</p>
          <p className="text-xs text-muted-foreground">This may take a moment</p>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && importResult && (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gain/10">
            <Check className="h-8 w-8 text-gain" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">Import complete</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {importResult.imported} transactions imported
              {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
            </p>
          </div>
          <Button onClick={clearFile}>Import another file</Button>
        </div>
      )}
    </div>
  );
}
