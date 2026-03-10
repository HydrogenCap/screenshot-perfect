import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

interface Provider {
  id: string;
  name: string;
  api_key?: string | null;
  api_environment?: string | null;
  last_synced_at?: string | null;
  sync_status?: string | null;
}

interface ProviderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider;
}

export function ProviderSettingsDialog({
  open,
  onOpenChange,
  provider,
}: ProviderSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState(provider.api_key ?? "");
  const [environment, setEnvironment] = useState(provider.api_environment ?? "live");
  const [showKey, setShowKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("providers")
        .update({ api_key: apiKey.trim() || null, api_environment: environment })
        .eq("id", provider.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("API settings saved");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to save"),
  });

  const handleSync = async () => {
    const keyToUse = apiKey.trim() || provider.api_key;
    if (!keyToUse) {
      toast.error("Enter an API key first");
      return;
    }

    setIsSyncing(true);
    try {
      // Persist any key change before syncing
      if (apiKey.trim() && apiKey.trim() !== (provider.api_key ?? "")) {
        await supabase
          .from("providers")
          .update({ api_key: apiKey.trim(), api_environment: environment })
          .eq("id", provider.id);
      }

      const { data, error } = await supabase.functions.invoke("trading212-sync", {
        body: { provider_id: provider.id },
      });

      if (error) throw new Error(error.message);

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all-valuations"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });

      toast.success(
        `Synced! Portfolio ${formatCurrency(data.portfolio_value)} · ${data.holdings_synced} position${data.holdings_synced !== 1 ? "s" : ""}`,
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const lastSynced = provider.last_synced_at
    ? new Date(provider.last_synced_at).toLocaleString()
    : "Never";

  const hasError = provider.sync_status && provider.sync_status !== "ok";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{provider.name} — API Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Paste your Trading 212 API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              In the Trading 212 app: <span className="font-medium">Settings → API</span> → generate a key
            </p>
          </div>

          <div className="space-y-2">
            <Label>Account type</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live account</SelectItem>
                <SelectItem value="demo">Practice (demo) account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Last synced</span>
              <span className="font-medium">{lastSynced}</span>
            </div>
            {hasError && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">Last error</span>
                <span className="text-destructive text-xs text-right leading-tight max-w-[220px]">
                  {provider.sync_status}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">What gets synced</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Account value, cash balance &amp; invested amount → saved as today's valuation</li>
              <li>All open positions → saved to Holdings</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save key"}
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing || (!apiKey.trim() && !provider.api_key)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
