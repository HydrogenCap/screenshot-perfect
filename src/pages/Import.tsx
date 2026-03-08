import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Import() {
  usePageTitle("Import CSV");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload transaction data from your providers
        </p>
      </div>

      <div className="flex items-center justify-center rounded-xl border-2 border-dashed bg-card p-16 transition-colors hover:border-primary/50">
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
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Browse Files
          </Button>
        </div>
      </div>

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
