import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import Papa from "papaparse";

export default function Import() {
  usePageTitle("Import CSV");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rowCount: number; sampleRows: string[][] } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setCsvFile(file);
    Papa.parse(file, {
      preview: 6,
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length > 0) {
          setCsvPreview({
            headers: data[0],
            rowCount: 0,
            sampleRows: data.slice(1, 6),
          });
          Papa.parse(file, {
            complete: (full) => {
              setCsvPreview((prev) =>
                prev ? { ...prev, rowCount: (full.data as string[][]).length - 1 } : prev
              );
            },
          });
        }
      },
    });
  };

  const clearFile = () => {
    setCsvFile(null);
    setCsvPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

      {!csvFile ? (
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
                Supports Trading212, Freetrade, Fidelity, Vanguard and more
              </p>
            </div>
            <Button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <FileText className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </div>
        </button>
      ) : (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{csvFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {csvPreview ? `${csvPreview.rowCount} rows detected` : "Parsing..."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {csvPreview && csvPreview.headers.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {csvPreview.headers.slice(0, 6).map((h, i) => (
                      <th key={i} className="text-left p-2 font-medium text-muted-foreground truncate max-w-[140px]">
                        {h}
                      </th>
                    ))}
                    {csvPreview.headers.length > 6 && (
                      <th className="text-left p-2 text-muted-foreground">
                        +{csvPreview.headers.length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.sampleRows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b last:border-0">
                      {row.slice(0, 6).map((cell, ci) => (
                        <td key={ci} className="p-2 truncate max-w-[140px]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Supported Providers</h3>
        <div className="flex flex-wrap gap-2">
          {[
            "Trading212", "Freetrade", "Fidelity", "Vanguard", "AJ Bell",
            "Hargreaves Lansdown", "Interactive Investor", "InvestEngine",
            "Chip", "Moneybox", "Generic CSV",
          ].map((provider) => (
            <span
              key={provider}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
            >
              {provider}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
