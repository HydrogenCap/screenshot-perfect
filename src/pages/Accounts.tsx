import { useState } from "react";
import { Plus, Search, BarChart3 } from "lucide-react";
import { accountTypeLabels } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";

const accountTypes = Constants.public.Enums.account_type;
const providerTypes = Constants.public.Enums.provider_type;

export default function Accounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Add Account form state
  const [providerName, setProviderName] = useState("");
  const [providerType, setProviderType] = useState<string>("investment_platform");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("new");

  // Add Valuation dialog state
  const [valDialogOpen, setValDialogOpen] = useState(false);
  const [valAccountId, setValAccountId] = useState<string>("");
  const [valAccountLabel, setValAccountLabel] = useState<string>("");
  const [valDate, setValDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [valTotal, setValTotal] = useState("");
  const [valCash, setValCash] = useState("");
  const [valInvested, setValInvested] = useState("");

  // Fetch accounts with provider + latest valuation
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*, providers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch latest valuation per account
      const accountIds = data.map((a: any) => a.id);
      if (accountIds.length === 0) return data.map((a: any) => ({ ...a, latestValuation: null }));

      const { data: valuations } = await supabase
        .from("valuations")
        .select("*")
        .in("account_id", accountIds)
        .order("valuation_date", { ascending: false });

      const latestByAccount: Record<string, any> = {};
      (valuations || []).forEach((v: any) => {
        if (!latestByAccount[v.account_id]) latestByAccount[v.account_id] = v;
      });

      return data.map((a: any) => ({ ...a, latestValuation: latestByAccount[a.id] || null }));
    },
    enabled: !!user,
  });

  // Fetch providers
  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addAccountMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let providerId = selectedProviderId;
      if (selectedProviderId === "new") {
        if (!providerName.trim()) throw new Error("Provider name is required");
        const { data: prov, error: provErr } = await supabase
          .from("providers")
          .insert({ name: providerName.trim(), provider_type: providerType as any, user_id: user.id })
          .select()
          .single();
        if (provErr) throw provErr;
        providerId = prov.id;
      }
      if (!accountName.trim()) throw new Error("Account name is required");
      if (!accountType) throw new Error("Account type is required");
      const { error } = await supabase.from("accounts").insert({
        account_name: accountName.trim(),
        account_type: accountType as any,
        provider_id: providerId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Account added");
      resetAccountForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to add account"),
  });

  const addValuationMutation = useMutation({
    mutationFn: async () => {
      if (!valAccountId) throw new Error("No account selected");
      const total = parseFloat(valTotal);
      const cash = parseFloat(valCash || "0");
      const invested = parseFloat(valInvested || "0");
      if (isNaN(total)) throw new Error("Total value is required");
      const { error } = await supabase.from("valuations").insert({
        account_id: valAccountId,
        valuation_date: valDate,
        total_value: total,
        cash_balance: cash,
        invested_value: invested,
        source: "manual" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Valuation added");
      resetValForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to add valuation"),
  });

  const resetAccountForm = () => {
    setDialogOpen(false);
    setProviderName("");
    setProviderType("investment_platform");
    setAccountName("");
    setAccountType("");
    setSelectedProviderId("new");
  };

  const resetValForm = () => {
    setValDialogOpen(false);
    setValAccountId("");
    setValAccountLabel("");
    setValDate(new Date().toISOString().slice(0, 10));
    setValTotal("");
    setValCash("");
    setValInvested("");
  };

  const openValDialog = (account: any) => {
    setValAccountId(account.id);
    setValAccountLabel(`${account.providers?.name} — ${account.account_name}`);
    setValDate(new Date().toISOString().slice(0, 10));
    setValTotal("");
    setValCash("");
    setValInvested("");
    setValDialogOpen(true);
  };

  const filtered = accounts.filter(
    (a: any) =>
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.providers?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}{" "}
            across {new Set(accounts.map((a: any) => a.provider_id)).size} provider{new Set(accounts.map((a: any) => a.provider_id)).size !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search accounts..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Value</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cash</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Invested</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No accounts yet. Click "Add Account" to get started.
                  </td>
                </tr>
              )}
              {filtered.map((account: any, i: number) => {
                const v = account.latestValuation;
                return (
                  <tr
                    key={account.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30 animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-4 py-3 font-medium">{account.providers?.name}</td>
                    <td className="px-4 py-3">{account.account_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {accountTypeLabels[account.account_type] || account.account_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {v ? formatCurrency(v.total_value) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {v ? formatCurrency(v.cash_balance) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {v ? formatCurrency(v.invested_value) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex h-2 w-2 rounded-full", account.is_active ? "bg-gain" : "bg-muted-foreground")} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => openValDialog(account)}>
                        <BarChart3 className="mr-1 h-3.5 w-3.5" />
                        Add Balance
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ New Provider</SelectItem>
                  {providers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProviderId === "new" && (
              <>
                <div className="space-y-2">
                  <Label>Provider Name</Label>
                  <Input placeholder="e.g. Trading212" value={providerName} onChange={(e) => setProviderName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Provider Type</Label>
                  <Select value={providerType} onValueChange={setProviderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providerTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input placeholder="e.g. ISA 2025/26" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t} value={t}>{accountTypeLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAccountForm}>Cancel</Button>
            <Button onClick={() => addAccountMutation.mutate()} disabled={addAccountMutation.isPending}>
              {addAccountMutation.isPending ? "Adding…" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Valuation Dialog */}
      <Dialog open={valDialogOpen} onOpenChange={setValDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Balance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{valAccountLabel}</p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={valDate} onChange={(e) => setValDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Total Value (£)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={valTotal} onChange={(e) => setValTotal(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cash Balance (£)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={valCash} onChange={(e) => setValCash(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Invested Value (£)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={valInvested} onChange={(e) => setValInvested(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetValForm}>Cancel</Button>
            <Button onClick={() => addValuationMutation.mutate()} disabled={addValuationMutation.isPending}>
              {addValuationMutation.isPending ? "Saving…" : "Save Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
