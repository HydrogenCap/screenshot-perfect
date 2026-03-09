import { useRef, useState } from "react";
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Papa from "papaparse";
import {
  BrokerKey,
  CanonicalTransaction,
  BROKER_DETECTION,
  BROKER_LABELS,
} from "@/lib/brokerMappings";
import { normaliseRows } from "@/hooks/useCsvNormaliser";
import { importTransactions } from "@/lib/importTransactions";
import ImportPreviewTable from "@/components/import/ImportPreviewTable";
import { cn } from "@/lib/utils";

type ImportStep = "upload" | "preview" | "importing" | "done";

function detectBroker(headers: string[]): BrokerKey | null {
  const normalised = headers.map((h) => h.trim());
  for (const [broker, required] of Object.entries(BROKER_DETECTION) as [BrokerKey, string[]][]) {
    if (required.every((r) => normalised.includes(r))) return broker;
  }
  return null;
}

/**
 * Fidelity CSVs have metadata rows before the actual header.
 */
function preprocessCSV(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.includes("Order date") && l.includes("Transaction type"));
  if (headerIdx > 0) {
    return lines.slice(headerIdx).join("\n");
  }
  return rawText;
}

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

export default function Import() {
  usePageTitle("Import CSV");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeBrokerTab, setActiveBrokerTab] = useState<BrokerKey>("freetrade");
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [detectedBroker, setDetectedBroker] = useState<BrokerKey | null>(null);
  const [parsedTxns, setParsedTxns] = useState<CanonicalTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [importResult, setImportResult] = useState<{ inserted: number; duplicates: number; errors: string[] } | null>(null);

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
      let rawText = ev.target?.result as string;
      // Strip BOM
      if (rawText.charCodeAt(0) === 0xfeff) {
        rawText = rawText.slice(1);
      }
      const cleanedText = preprocessCSV(rawText);

      Papa.parse(cleanedText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          if (rows.length === 0) {
            toast.error("CSV file is empty");
            return;
          }

          const headers = Object.keys(rows[0]);
          console.log("CSV headers detected:", headers);
          const broker = detectBroker(headers);
          console.log("Broker detected:", broker);

          if (!broker) {
            toast.error("Could not detect CSV format. Supported: Freetrade, Fidelity, Trading 212");
            return;
          }

          setDetectedBroker(broker);
          setActiveBrokerTab(broker);

          const txns = normaliseRows(rows, broker);
          console.log(`Normalised ${txns.length} transactions from ${broker}`, txns.slice(0, 3));
          setParsedTxns(txns);
          setStep("preview");
          toast.success(`Detected ${BROKER_LABELS[broker]} — ${txns.length} transactions parsed`);
        },
        error: (err: any) => {
          toast.error(`Error parsing CSV: ${err.message}`);
        },
      });
    };
    reader.readAsText(file);
  };

  const doImport = useMutation({
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

      const result = await importTransactions(parsedTxns, user.id, selectedAccountId, importRecord.id);

      // Update import record
      await supabase
        .from("imports")
        .update({
          status: "confirmed" as any,
          imported_count: result.inserted,
          skipped_count: result.duplicates,
          error_count: result.errors.length,
          error_log: result.errors.length > 0 ? result.errors as any : null,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-value"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });

      const msg = `Import complete — ${result.inserted} transactions added` +
        (result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : "");
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error(err.message || "Import failed");
      setStep("preview");
    },
  });

  const clearFile = () => {
    setCsvFile(null);
    setParsedTxns([]);
    setDetectedBroker(null);
    setSelectedAccountId("");
    setImportResult(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const typeCounts = parsedTxns.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  const totalValue = parsedTxns.reduce((sum, t) => sum + t.netAmountGbp, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload transaction data from your broker
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Step: Upload — with broker tabs */}
      {step === "upload" && (
        <Tabs value={activeBrokerTab} onValueChange={(v) => setActiveBrokerTab(v as BrokerKey)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="freetrade">Freetrade</TabsTrigger>
            <TabsTrigger value="fidelity">Fidelity</TabsTrigger>
            <TabsTrigger value="trading212">Trading 212</TabsTrigger>
          </TabsList>

          {(["freetrade", "fidelity", "trading212"] as BrokerKey[]).map((broker) => (
            <TabsContent key={broker} value={broker} className="space-y-4">
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
                    <h3 className="text-lg font-semibold">Drop your {BROKER_LABELS[broker]} CSV here</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {broker === "freetrade" && "Export from Profile → Statements & History → Download CSV"}
                      {broker === "fidelity" && "Export from Portfolio → Transaction History → Export to CSV"}
                      {broker === "trading212" && "Export from History → Export → CSV (one file per account)"}
                    </p>
                  </div>
                  <Button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <FileText className="mr-2 h-4 w-4" />
                    Browse Files
                  </Button>
                </div>
              </button>

              {broker === "trading212" && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Trading 212 exports one file per account (ISA / Invest). Select the correct account after upload.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
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
                  {detectedBroker ? BROKER_LABELS[detectedBroker] : "Unknown"} · {parsedTxns.length} transactions
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <Badge key={type} variant="outline" className={cn("text-xs", TYPE_COLORS[type])}>
                {type} ({count})
              </Badge>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {parsedTxns.length} valid · {parsedTxns.length} rows detected
            </span>
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
          <ImportPreviewTable transactions={parsedTxns} />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button
              onClick={() => doImport.mutate()}
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
              {importResult.inserted} transactions added
              {importResult.duplicates > 0 && `, ${importResult.duplicates} duplicates skipped`}
            </p>
            {importResult.errors.length > 0 && (
              <p className="text-xs text-destructive mt-2">
                {importResult.errors.length} error(s) — check console for details
              </p>
            )}
          </div>
          <Button onClick={clearFile}>Import another file</Button>
        </div>
      )}
    </div>
  );
}
