import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { mockAccounts, accountTypeLabels } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Accounts() {
  const [search, setSearch] = useState("");
  const filtered = mockAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {mockAccounts.length} accounts across {new Set(mockAccounts.map((a) => a.provider)).size} providers
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Import</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cash</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Invested</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account, i) => (
                <tr
                  key={account.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30 cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-4 py-3 font-medium">{account.provider}</td>
                  <td className="px-4 py-3">{account.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {accountTypeLabels[account.type] || account.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {account.lastImport ? formatDate(account.lastImport) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {formatCurrency(account.value)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(account.cash)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(account.invested)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex h-2 w-2 rounded-full",
                        account.active ? "bg-gain" : "bg-muted-foreground"
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
