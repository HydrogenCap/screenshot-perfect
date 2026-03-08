import { useState } from "react";
import { User, Database, Calendar, Bell, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import Papa from "papaparse";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  usePageTitle("Settings");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user settings
  const { data: settings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [displayName, setDisplayName] = useState("");
  const [isaWarning, setIsaWarning] = useState(true);
  const [taxYearReminder, setTaxYearReminder] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);

  // Initialize form values when data loads
  useState(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (settings) {
      setIsaWarning(settings.isa_warning ?? true);
      setTaxYearReminder(settings.tax_year_reminder ?? true);
      setWeeklySummary(settings.weekly_summary_email ?? false);
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Check if profile exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: displayName.trim() || null })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, display_name: displayName.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update profile"),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const payload = {
        isa_warning: isaWarning,
        tax_year_reminder: taxYearReminder,
        weekly_summary_email: weeklySummary,
      };
      
      if (existing) {
        const { error } = await supabase
          .from("user_settings")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_settings")
          .insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Preferences saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save preferences"),
  });

  const handleExportAll = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const zip = new JSZip();

      // Fetch and export all tables
      const tables = ["accounts", "transactions", "instruments", "holdings", "valuations", "providers"];
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          continue;
        }
        if (data && data.length > 0) {
          const csv = Papa.unparse(data);
          zip.file(`${table}.csv`, csv);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete in order to respect foreign keys
      await supabase.from("holdings").delete().neq("id", "");
      await supabase.from("valuations").delete().neq("id", "");
      await supabase.from("transactions").delete().neq("id", "");
      await supabase.from("imports").delete().neq("id", "");
      await supabase.from("instruments").delete().neq("id", "");
      await supabase.from("accounts").delete().neq("id", "");
      await supabase.from("csv_mappings").delete().neq("id", "");
      await supabase.from("providers").delete().neq("id", "");

      queryClient.invalidateQueries();
      toast.success("All data deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete data");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Profile</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Base Currency</Label>
            <Input value={profile?.base_currency || "GBP"} disabled />
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => updateProfileMutation.mutate()}
          disabled={updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? "Saving…" : "Save Profile"}
        </Button>
      </section>

      {/* Tax Year */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Tax Year</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tax Year Start</Label>
            <Input value="6 April" disabled />
          </div>
          <div className="space-y-2">
            <Label>ISA Contribution Limit</Label>
            <Input value={`£${(profile?.isa_limit || 20000).toLocaleString()}`} disabled />
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Notification Preferences</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">ISA Limit Warning</p>
              <p className="text-xs text-muted-foreground">Get notified when approaching ISA limit</p>
            </div>
            <Switch checked={isaWarning} onCheckedChange={setIsaWarning} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tax Year Reminder</p>
              <p className="text-xs text-muted-foreground">Reminder before tax year ends</p>
            </div>
            <Switch checked={taxYearReminder} onCheckedChange={setTaxYearReminder} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Weekly Summary Email</p>
              <p className="text-xs text-muted-foreground">Weekly portfolio performance summary</p>
            </div>
            <Switch checked={weeklySummary} onCheckedChange={setWeeklySummary} />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateSettingsMutation.mutate()}
          disabled={updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? "Saving…" : "Save Preferences"}
        </Button>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Data Management</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Export all your data as a ZIP file containing CSV files, or delete all data permanently.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleExportAll} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export All Data"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your accounts,
                  transactions, instruments, holdings, and valuations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Deleting…" : "Delete Everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
