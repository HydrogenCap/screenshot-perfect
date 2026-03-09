import { useState, useMemo } from "react";
import { BookOpen, Search, Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";
import { usePageTitle } from "@/hooks/usePageTitle";

const assetClasses = Constants.public.Enums.asset_class;

const assetClassLabels: Record<string, string> = {
  equity: "Equity",
  etf: "ETF",
  fund: "Fund",
  investment_trust: "Investment Trust",
  bond: "Bond",
  gilt: "Gilt",
  cash: "Cash",
  commodity: "Commodity",
  crypto: "Crypto",
  property: "Property",
  alternative: "Alternative",
  other: "Other",
};

type SortKey = "name" | "ticker" | "asset_class" | "quantity" | "current_value";
type SortDir = "asc" | "desc";

export default function Instruments() {
  usePageTitle("Instruments");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupByClass, setGroupByClass] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  // Form state
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [isin, setIsin] = useState("");
  const [assetClass, setAssetClass] = useState<string>("equity");
  const [currency, setCurrency] = useState("GBP");

  // Fetch instruments with holdings data
  const { data: instruments = [], isLoading } = useQuery({
    queryKey: ["instruments-with-holdings"],
    queryFn: async () => {
      const { data: insts, error } = await supabase
        .from("instruments")
        .select("*")
        .order("name");
      if (error) throw error;

      // Fetch holdings to calculate totals
      const { data: holdings } = await supabase
        .from("holdings")
        .select("instrument_id, quantity, current_value, cost_basis");

      const holdingsByInstrument: Record<string, { quantity: number; current_value: number; cost_basis: number }> = {};
      (holdings || []).forEach((h: any) => {
        if (h.instrument_id) {
          if (!holdingsByInstrument[h.instrument_id]) {
            holdingsByInstrument[h.instrument_id] = { quantity: 0, current_value: 0, cost_basis: 0 };
          }
          holdingsByInstrument[h.instrument_id].quantity += h.quantity;
          holdingsByInstrument[h.instrument_id].current_value += h.current_value;
          holdingsByInstrument[h.instrument_id].cost_basis += h.cost_basis;
        }
      });

      return insts.map((inst: any) => ({
        ...inst,
        holdings: holdingsByInstrument[inst.id] || { quantity: 0, current_value: 0, cost_basis: 0 },
      }));
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return instruments.filter(
      (i: any) =>
        i.name.toLowerCase().includes(q) ||
        (i.ticker || "").toLowerCase().includes(q) ||
        (i.isin || "").toLowerCase().includes(q)
    );
  }, [instruments, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      switch (sortKey) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "ticker":
          aVal = (a.ticker || "").toLowerCase();
          bVal = (b.ticker || "").toLowerCase();
          break;
        case "asset_class":
          aVal = a.asset_class;
          bVal = b.asset_class;
          break;
        case "quantity":
          aVal = a.holdings?.quantity || 0;
          bVal = b.holdings?.quantity || 0;
          break;
        case "current_value":
          aVal = a.holdings?.current_value || 0;
          bVal = b.holdings?.current_value || 0;
          break;
        default:
          aVal = a.name;
          bVal = b.name;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (!groupByClass) return null;
    const groups: Record<string, any[]> = {};
    sorted.forEach((inst: any) => {
      const cls = inst.asset_class || "other";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(inst);
    });
    return groups;
  }, [sorted, groupByClass]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!name.trim()) throw new Error("Name is required");

      const payload = {
        name: name.trim(),
        ticker: ticker.trim() || null,
        isin: isin.trim() || null,
        asset_class: assetClass as any,
        currency,
        user_id: user.id,
      };

      if (editId) {
        const { error } = await supabase.from("instruments").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("instruments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments-with-holdings"] });
      toast.success(editId ? "Instrument updated" : "Instrument added");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (instrumentId: string) => {
      // Check if any transactions reference this instrument
      const { count, error: countError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("instrument_id", instrumentId);
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`Cannot delete: ${count} transaction(s) reference this instrument`);
      }
      const { error } = await supabase.from("instruments").delete().eq("id", instrumentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments-with-holdings"] });
      toast.success("Instrument deleted");
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditId(null);
    setName("");
    setTicker("");
    setIsin("");
    setAssetClass("equity");
    setCurrency("GBP");
  };

  const openEditDialog = (inst: any) => {
    setEditId(inst.id);
    setName(inst.name);
    setTicker(inst.ticker || "");
    setIsin(inst.isin || "");
    setAssetClass(inst.asset_class);
    setCurrency(inst.currency);
    setDialogOpen(true);
  };

  const openDeleteDialog = (inst: any) => {
    setDeleteId(inst.id);
    setDeleteName(inst.name);
  };

  const renderTable = (items: any[]) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/40">
          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
              Name <ArrowUpDown className="h-3 w-3" />
            </button>
          </th>
          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("ticker")}>
              Ticker <ArrowUpDown className="h-3 w-3" />
            </button>
          </th>
          <th className="px-4 py-3 text-left font-medium text-muted-foreground">ISIN</th>
          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("asset_class")}>
              Class <ArrowUpDown className="h-3 w-3" />
            </button>
          </th>
          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
            <button className="flex items-center gap-1 justify-end hover:text-foreground" onClick={() => toggleSort("quantity")}>
              Qty Held <ArrowUpDown className="h-3 w-3" />
            </button>
          </th>
          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
            <button className="flex items-center gap-1 justify-end hover:text-foreground" onClick={() => toggleSort("current_value")}>
              Value <ArrowUpDown className="h-3 w-3" />
            </button>
          </th>
          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gain/Loss</th>
          <th className="px-4 py-3 w-10"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((inst: any, i: number) => {
          const gain = inst.holdings.current_value - inst.holdings.cost_basis;
          return (
            <tr
              key={inst.id}
              className="border-b last:border-0 transition-colors hover:bg-muted/30 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <td className="px-4 py-3 font-medium">{inst.name}</td>
              <td className="px-4 py-3 font-mono text-muted-foreground">{inst.ticker || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{inst.isin || "—"}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className="text-[10px]">
                  {assetClassLabels[inst.asset_class] || inst.asset_class}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {inst.holdings.quantity > 0 ? inst.holdings.quantity.toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {inst.holdings.current_value > 0 ? formatCurrency(inst.holdings.current_value) : "—"}
              </td>
              <td className={cn("px-4 py-3 text-right font-mono", gain > 0 ? "text-gain" : gain < 0 ? "text-loss" : "text-muted-foreground")}>
                {inst.holdings.cost_basis > 0 ? formatCurrency(gain, "GBP", { showSign: true }) : "—"}
              </td>
              <td className="px-4 py-3 space-x-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(inst)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(inst)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Instruments</h1>
          <p className="text-sm text-muted-foreground">
            {instruments.length} securities, funds and assets in your portfolio
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Instrument
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, ticker or ISIN..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setGroupByClass(!groupByClass)}>
          {groupByClass ? "Ungroup" : "Group by Class"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading instruments...</div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No instruments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Import transactions or add instruments manually to get started.
          </p>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cls, items]) => (
            <div key={cls} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b">
                <h3 className="text-sm font-semibold">{assetClassLabels[cls] || cls}</h3>
              </div>
              <div className="overflow-x-auto">{renderTable(items)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">{renderTable(sorted)}</div>
        </div>
      )}

      {/* Add/Edit Instrument Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Instrument" : "Add Instrument"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Apple Inc" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ticker</Label>
                <Input placeholder="e.g. AAPL" value={ticker} onChange={(e) => setTicker(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ISIN</Label>
                <Input placeholder="e.g. US0378331005" value={isin} onChange={(e) => setIsin(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Class</Label>
                <Select value={assetClass} onValueChange={setAssetClass}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assetClasses.map((c) => (
                      <SelectItem key={c} value={c}>{assetClassLabels[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editId ? "Update" : "Add Instrument"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
