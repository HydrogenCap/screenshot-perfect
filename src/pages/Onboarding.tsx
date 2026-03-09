import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X, Upload, Check, ArrowRight, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

const PROVIDER_OPTIONS = [
  "Trading212", "Freetrade", "Fidelity", "Vanguard", "AJ Bell",
  "Hargreaves Lansdown", "Interactive Investor", "InvestEngine",
  "Chip", "Moneybox", "NS&I", "Other",
];

const PROVIDER_TYPE_MAP: Record<string, string> = {
  "Trading212": "investment_platform",
  "Freetrade": "investment_platform",
  "Fidelity": "investment_platform",
  "Vanguard": "investment_platform",
  "AJ Bell": "investment_platform",
  "Hargreaves Lansdown": "investment_platform",
  "Interactive Investor": "investment_platform",
  "InvestEngine": "investment_platform",
  "Chip": "savings_platform",
  "Moneybox": "savings_platform",
  "NS&I": "bank",
  "Other": "investment_platform",
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: "stocks_and_shares_isa", label: "Stocks & Shares ISA" },
  { value: "cash_isa", label: "Cash ISA" },
  { value: "sipp", label: "SIPP" },
  { value: "gia", label: "GIA" },
  { value: "savings_account", label: "Premium Bonds" },
  { value: "cash_savings", label: "Savings" },
  { value: "other", label: "Other" },
];

interface AccountEntry {
  provider: string;
  accountName: string;
  accountType: string;
  totalValue: string;
}

const emptyAccount = (): AccountEntry => ({
  provider: "",
  accountName: "",
  accountType: "",
  totalValue: "",
});

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("GBP");

  // Step 2
  const [accounts, setAccounts] = useState<AccountEntry[]>([emptyAccount()]);
  const [skippedAccounts, setSkippedAccounts] = useState(false);

  // Step 4
  const [isaAccountIndices, setIsaAccountIndices] = useState<Set<number>>(new Set());
  const [noIsas, setNoIsas] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setDisplayName(user.email.split("@")[0]);
    }
  }, [user]);

  // Pre-check ISA accounts when reaching step 4
  useEffect(() => {
    if (step === 4 && !skippedAccounts) {
      const isaIndices = new Set<number>();
      accounts.forEach((a, i) => {
        if (a.accountType === "stocks_and_shares_isa" || a.accountType === "cash_isa") {
          isaIndices.add(i);
        }
      });
      setIsaAccountIndices(isaIndices);
    }
  }, [step]);

  const validAccounts = accounts.filter(
    (a) => a.provider && a.accountName && a.accountType && a.totalValue
  );

  const canProceed = () => {
    switch (step) {
      case 1:
        return displayName.trim().length > 0;
      case 2:
        return skippedAccounts || validAccounts.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const updateAccount = (index: number, field: keyof AccountEntry, value: string) => {
    setAccounts((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const removeAccount = (index: number) => {
    if (accounts.length === 1) {
      setAccounts([emptyAccount()]);
    } else {
      setAccounts((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (!user) throw new Error("Not authenticated");

      // 1. Upsert profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName, base_currency: baseCurrency })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      // 2. Insert accounts + valuations
      if (!skippedAccounts && validAccounts.length > 0) {
        for (const acc of validAccounts) {
          // Find or create provider
          const { data: existingProvider } = await supabase
            .from("providers")
            .select("id")
            .eq("user_id", user.id)
            .eq("name", acc.provider)
            .maybeSingle();

          let providerId = existingProvider?.id;
          if (!providerId) {
            const { data: newProvider, error: provErr } = await supabase
              .from("providers")
              .insert({
                user_id: user.id,
                name: acc.provider,
                provider_type: (PROVIDER_TYPE_MAP[acc.provider] || "investment_platform") as any,
              })
              .select("id")
              .single();
            if (provErr) throw provErr;
            providerId = newProvider.id;
          }

          const { data: newAccount, error: accErr } = await supabase
            .from("accounts")
            .insert({
              user_id: user.id,
              provider_id: providerId,
              account_name: acc.accountName,
              account_type: acc.accountType as any,
            })
            .select("id")
            .single();
          if (accErr) throw accErr;

          // Opening valuation
          const totalVal = parseFloat(acc.totalValue) || 0;
          const { error: valErr } = await supabase.from("valuations").insert({
            account_id: newAccount.id,
            valuation_date: new Date().toISOString().split("T")[0],
            total_value: totalVal,
            cash_balance: 0,
            invested_value: totalVal,
          });
          if (valErr) throw valErr;
        }
      }

      // 3. Mark onboarding complete
      const { data: existingSettings } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSettings) {
        await supabase
          .from("user_settings")
          .update({ onboarding_complete: true } as any)
          .eq("user_id", user.id);
      } else {
        await supabase.from("user_settings").insert({
          user_id: user.id,
          onboarding_complete: true,
        } as any);
      }

      toast.success("Setup complete!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step === 5) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const isaTotal = !skippedAccounts
    ? Array.from(isaAccountIndices).reduce((sum, i) => {
        return sum + (parseFloat(accounts[i]?.totalValue || "0") || 0);
      }, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[560px]">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>

        <Card className="p-6 sm:p-8 shadow-lg">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Welcome to your Portfolio Tracker</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Let's get you set up in a few quick steps.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base currency</Label>
                  <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Tax year start</Label>
                  <p className="text-sm">6 April — UK standard</p>
                  <p className="text-xs text-muted-foreground">This follows the UK tax year</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Add your investment accounts</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Add one or more accounts. You can always add more later.
                </p>
              </div>
              <div className="space-y-4">
                {accounts.map((acc, i) => (
                  <div key={i} className="relative rounded-lg border p-4 space-y-3">
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground"
                      onClick={() => removeAccount(i)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Provider</Label>
                        <Select value={acc.provider} onValueChange={(v) => updateAccount(i, "provider", v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {PROVIDER_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account name</Label>
                        <Input
                          className="h-9 text-sm"
                          value={acc.accountName}
                          onChange={(e) => updateAccount(i, "accountName", e.target.value)}
                          placeholder="e.g. My ISA"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account type</Label>
                        <Select value={acc.accountType} onValueChange={(v) => updateAccount(i, "accountType", v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Current total value</Label>
                        <Input
                          className="h-9 text-sm"
                          type="number"
                          value={acc.totalValue}
                          onChange={(e) => updateAccount(i, "totalValue", e.target.value)}
                          placeholder="0.00"
                          min={0}
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add another account
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Import your transaction history</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a CSV export from your broker to populate your portfolio history. You can skip this and do it later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex w-full items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors hover:border-primary/50 cursor-pointer"
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You can import transactions from the Import page after setup
                  </p>
                </div>
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Supported formats: Trading212, Freetrade, Hargreaves Lansdown, AJ Bell, Vanguard, InvestEngine, Interactive Investor
              </p>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Track your ISA allowance</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  The annual ISA allowance is £20,000. Tell us which of your accounts are ISAs so we can track it for you.
                </p>
              </div>

              {!skippedAccounts && validAccounts.length > 0 ? (
                <div className="space-y-3">
                  {validAccounts.map((acc, i) => {
                    const originalIndex = accounts.indexOf(acc);
                    const checked = isaAccountIndices.has(originalIndex);
                    return (
                      <label key={i} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                        <Checkbox
                          checked={checked}
                          disabled={noIsas}
                          onCheckedChange={(c) => {
                            setIsaAccountIndices((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(originalIndex);
                              else next.delete(originalIndex);
                              return next;
                            });
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium">{acc.accountName}</p>
                          <p className="text-xs text-muted-foreground">{acc.provider}</p>
                        </div>
                      </label>
                    );
                  })}

                  {isaAccountIndices.size > 0 && !noIsas && (
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <p className="text-sm">
                        Based on your opening balances, you've used{" "}
                        <span className="font-semibold">{formatCurrency(isaTotal)}</span> of your{" "}
                        <span className="font-semibold">£20,000</span> allowance this tax year
                      </p>
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isaTotal / 20000 < 0.75
                              ? "bg-gain"
                              : isaTotal / 20000 < 0.95
                              ? "bg-[hsl(31,97%,62%)]"
                              : "bg-loss"
                          )}
                          style={{ width: `${Math.min(100, (isaTotal / 20000) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This is estimated from your opening balances. Import transactions for accuracy.
                      </p>
                    </div>
                  )}

                  <label className="flex items-center gap-3 pt-2 cursor-pointer">
                    <Checkbox
                      checked={noIsas}
                      onCheckedChange={(c) => {
                        setNoIsas(!!c);
                        if (c) setIsaAccountIndices(new Set());
                      }}
                    />
                    <span className="text-sm text-muted-foreground">None of my accounts are ISAs</span>
                  </label>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No accounts added yet. You can set up ISA tracking later in Settings after adding accounts.
                </p>
              )}
            </div>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">You're all set! 🎉</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Here's what we've set up for you:
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-gain" />
                  <span>Profile: {displayName}</span>
                </div>
                {!skippedAccounts && validAccounts.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-gain" />
                    <span>
                      {validAccounts.length} account(s) added — total value{" "}
                      {formatCurrency(validAccounts.reduce((s, a) => s + (parseFloat(a.totalValue) || 0), 0))}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="ml-6">Account setup skipped</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="ml-6">Transaction import skipped</span>
                </div>
                {isaAccountIndices.size > 0 && !noIsas ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-gain" />
                    <span>
                      ISA tracker enabled for:{" "}
                      {Array.from(isaAccountIndices)
                        .map((i) => accounts[i]?.accountName)
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="ml-6">ISA tracking skipped</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                You can update any of these settings at any time in Settings.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    setSkippedAccounts(true);
                    setStep(3);
                  }}
                >
                  Skip for now
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setStep(4)}
                >
                  I'll do this later
                </button>
              )}
              {step === 4 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => {
                    setNoIsas(true);
                    setIsaAccountIndices(new Set());
                    setStep(5);
                  }}
                >
                  Skip ISA tracking
                </button>
              )}
              <Button
                onClick={handleNext}
                disabled={!canProceed() || saving}
              >
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {step === 1
                  ? "Get started"
                  : step === 5
                  ? "Go to Dashboard"
                  : "Next"}
                {step === 5 ? (
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                ) : null}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
