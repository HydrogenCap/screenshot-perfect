import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type TransactionType = Database["public"]["Enums"]["transaction_type"];
const transactionTypes = Constants.public.Enums.transaction_type;

const schema = z.object({
  transaction_date: z.string().min(1, "Date is required"),
  account_id: z.string().min(1, "Select an account"),
  type: z.string().min(1, "Select a type"),
  instrument_id: z.string().optional(),
  quantity: z.coerce.number().optional().nullable(),
  price_per_unit: z.coerce.number().optional().nullable(),
  total_amount: z.coerce.number({ required_error: "Total amount is required" }),
  fees: z.coerce.number().default(0),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Account {
  id: string;
  account_name: string;
  providers: { name: string } | null;
}

interface Instrument {
  id: string;
  name: string;
  ticker: string | null;
}

interface TransactionData {
  id: string;
  transaction_date: string;
  account_id: string;
  type: string;
  instrument_id: string | null;
  quantity: number | null;
  price_per_unit: number | null;
  total_amount: number;
  fees: number;
  notes: string | null;
}

interface TransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  instruments: Instrument[];
  editData?: TransactionData | null;
  onSaved: () => void;
}

export function TransactionSheet({
  open, onOpenChange, accounts, instruments, editData, onSaved,
}: TransactionSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_date: new Date().toISOString().slice(0, 10),
      account_id: "",
      type: "",
      instrument_id: "",
      quantity: null,
      price_per_unit: null,
      total_amount: 0,
      fees: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (editData) {
      form.reset({
        transaction_date: editData.transaction_date,
        account_id: editData.account_id,
        type: editData.type,
        instrument_id: editData.instrument_id || "",
        quantity: editData.quantity,
        price_per_unit: editData.price_per_unit,
        total_amount: editData.total_amount,
        fees: editData.fees,
        notes: editData.notes || "",
      });
    } else {
      form.reset({
        transaction_date: new Date().toISOString().slice(0, 10),
        account_id: "",
        type: "",
        instrument_id: "",
        quantity: null,
        price_per_unit: null,
        total_amount: 0,
        fees: 0,
        notes: "",
      });
    }
  }, [editData, form]);

  const txType = form.watch("type");

  // Which fields are relevant for each transaction type
  const showInstrument = ["buy", "sell", "dividend", "corporate_action", "stock_split", "other"].includes(txType);
  const showQtyPrice = ["buy", "sell", "stock_split", "other"].includes(txType);

  const qty = form.watch("quantity");
  const price = form.watch("price_per_unit");
  useEffect(() => {
    if (qty != null && price != null && qty > 0 && price > 0) {
      form.setValue("total_amount", Number((qty * price).toFixed(2)));
    }
  }, [qty, price, form]);

  // Clear instrument/qty/price when switching to a type that doesn't use them
  useEffect(() => {
    if (!showInstrument) {
      form.setValue("instrument_id", "");
    }
    if (!showQtyPrice) {
      form.setValue("quantity", null);
      form.setValue("price_per_unit", null);
    }
  }, [txType, showInstrument, showQtyPrice, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        transaction_date: values.transaction_date,
        account_id: values.account_id,
        type: values.type as TransactionType,
        instrument_id: values.instrument_id || null,
        quantity: values.quantity || null,
        price_per_unit: values.price_per_unit || null,
        total_amount: values.total_amount,
        fees: values.fees,
        notes: values.notes || null,
      };

      if (editData) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editData.id);
        if (error) throw error;
        toast.success("Transaction updated");
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
        toast.success("Transaction added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    }
  };

  const typeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editData ? "Edit Transaction" : "Add Transaction"}</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField control={form.control} name="transaction_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="account_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.providers?.name} — {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {transactionTypes.map(t => (
                      <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {showInstrument && (
              <FormField control={form.control} name="instrument_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Instrument{txType === "other" ? " (optional)" : ""}</FormLabel>
                  <Select
                    onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {instruments.map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} {i.ticker ? `(${i.ticker})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {showQtyPrice && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price_per_unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per unit (£)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <FormField control={form.control} name="total_amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Total amount (£)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="fees" render={({ field }) => (
              <FormItem>
                <FormLabel>Fees (£)</FormLabel>
                <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} placeholder="Optional notes..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving…"
                : editData ? "Update Transaction" : "Add Transaction"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
