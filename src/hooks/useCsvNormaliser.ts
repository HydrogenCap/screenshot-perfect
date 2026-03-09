/**
 * Hook that normalises raw PapaParse row objects into CanonicalTransaction arrays.
 * Each broker has its own mapping logic following csv-import-guide.md.
 */

import { useCallback } from "react";
import {
  BrokerKey,
  CanonicalTransaction,
  CanonicalType,
  FREETRADE_TYPE_MAP,
  FREETRADE_SKIP_TYPES,
  TRADING212_TYPE_MAP,
  FIDELITY_TYPE_MAP,
  FIDELITY_SKIP_TYPES,
} from "@/lib/brokerMappings";

// ─── Helpers ────────────────────────────────────────────────────────

function num(val: string | undefined | null): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseIsoDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toISOString().split("T")[0];
  } catch {
    return raw;
  }
}

function parseFidelityDate(raw: string): string {
  if (!raw || raw.trim() === "") return "";
  try {
    const d = new Date(raw.trim());
    if (isNaN(d.getTime())) return raw;
    return d.toISOString().split("T")[0];
  } catch {
    return raw;
  }
}

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}

// ─── Freetrade normaliser ───────────────────────────────────────────

function normaliseFreetrade(row: Record<string, string>): CanonicalTransaction | null {
  const rawType = (row["Type"] || "").trim();
  const typeLower = rawType.toLowerCase().replace(/\s+/g, "_");

  if (FREETRADE_SKIP_TYPES.has(typeLower)) return null;

  let type: CanonicalType = FREETRADE_TYPE_MAP[typeLower] || "other";

  // Refine buy/sell from "Buy / Sell" column
  const buySell = (row["Buy / Sell"] || "").trim().toLowerCase();
  if (buySell === "sell") type = "sell";
  else if (buySell === "buy") type = "buy";

  const totalAmount = num(row["Total Amount in Account Currency"]) || num(row["Total Amount"]) || 0;
  const fxFee = num(row["FX Fee Amount"]) || 0;
  const stampDuty = num(row["Stamp Duty"]) || 0;
  const fees = fxFee + stampDuty;
  const grossAmount = Math.abs(totalAmount) + fees;
  const currency = row["Account Currency"]?.trim() || "GBP";
  const tradeDate = parseIsoDate(row["Timestamp"] || "");

  if (!isValidDate(tradeDate)) {
    console.warn("Freetrade: skipping row with invalid date:", row["Timestamp"]);
    return null;
  }

  return {
    broker: "freetrade",
    tradeDate,
    settleDate: null,
    ticker: row["Ticker"]?.trim() || row["Symbol"]?.trim() || null,
    isin: row["ISIN"]?.trim() || null,
    instrument: row["Title"]?.trim() || null,
    type,
    quantity: num(row["Quantity"]) || num(row["Shares"]),
    price: num(row["Price per Share in Account Currency"] || row["Price per Share"] || row["Price per share"]),
    currency,
    fxRate: num(row["FX Rate"] || row["Base FX Rate"]),
    grossAmount,
    fees,
    netAmountGbp: Math.abs(totalAmount),
    notes: row["Notes"]?.trim() || null,
    rawRow: row,
  };
}

// ─── Trading 212 normaliser ─────────────────────────────────────────

function normaliseTrading212(row: Record<string, string>): CanonicalTransaction | null {
  const action = (row["Action"] || "").trim();
  const actionLower = action.toLowerCase();

  const type: CanonicalType = TRADING212_TYPE_MAP[actionLower] || "other";

  // Find total column (GBP/EUR/USD variants)
  const totalCol =
    row["Total (GBP)"] ?? row["Total (EUR)"] ?? row["Total (USD)"] ?? row["Total"] ?? "";
  const totalHeader = Object.keys(row).find((k) => k.startsWith("Total ("));
  const currency = totalHeader ? totalHeader.match(/\((\w+)\)/)?.[1] || "GBP" : "GBP";

  // Sum all fee columns
  const fxFee = num(
    row["Currency conversion fee (GBP)"] ??
    row["Currency conversion fee (EUR)"] ??
    row["Currency conversion fee (USD)"] ?? ""
  ) || 0;
  const txnFee = num(
    row["Transaction fee (GBP)"] ??
    row["Transaction fee (EUR)"] ??
    row["Transaction fee (USD)"] ?? ""
  ) || 0;
  const finraFee = num(
    row["Finra fee (GBP)"] ??
    row["Finra fee (EUR)"] ??
    row["Finra fee (USD)"] ?? ""
  ) || 0;
  const stampDuty = num(
    row["Stamp duty reserve tax (GBP)"] ??
    row["Stamp duty reserve tax (EUR)"] ??
    row["Stamp duty reserve tax (USD)"] ?? ""
  ) || 0;

  const fees = fxFee + txnFee + finraFee + stampDuty;
  const netAmount = Math.abs(num(totalCol) || 0);
  const qty = num(row["No. of shares"]);
  const price = num(row["Price / share"]);
  const grossAmount = qty && price ? Math.abs(qty * price) : netAmount;

  const tradeDate = parseIsoDate(row["Time"] || "");
  if (!isValidDate(tradeDate)) {
    console.warn("Trading212: skipping row with invalid date:", row["Time"]);
    return null;
  }

  return {
    broker: "trading212",
    tradeDate,
    settleDate: null,
    ticker: row["Ticker"]?.trim() || null,
    isin: row["ISIN"]?.trim() || null,
    instrument: row["Name"]?.trim() || null,
    type,
    quantity: qty,
    price,
    currency,
    fxRate: num(row["Exchange rate"]),
    grossAmount,
    fees,
    netAmountGbp: netAmount,
    notes: [row["Notes"], row["ID"]].filter(Boolean).join(" | ") || null,
    rawRow: row,
  };
}

// ─── Fidelity normaliser ────────────────────────────────────────────

function normaliseFidelity(row: Record<string, string>): CanonicalTransaction | null {
  const rawType = (row["Transaction type"] || "").trim();
  const typeLower = rawType.toLowerCase();

  if (FIDELITY_SKIP_TYPES.has(typeLower)) return null;

  const type: CanonicalType = FIDELITY_TYPE_MAP[typeLower] || "other";
  const investment = (row["Investments"] || "").trim();

  // Skip "Cash" buy entries (internal cash allocation)
  if (type === "buy" && investment.toLowerCase() === "cash") return null;

  const amount = num(row["Amount"]);
  const quantity = num(row["Quantity"]);
  const pricePerUnit = num(row["Price per unit"]);
  const fees = Math.abs(num(row["Commission/Charges"]) || 0);

  const tradeDate = parseFidelityDate(row["Completion date"] || row["Order date"] || "");
  if (!isValidDate(tradeDate)) {
    console.warn("Fidelity: skipping row with invalid date:", row["Completion date"], row["Order date"]);
    return null;
  }

  const settleDate = row["Completion date"]
    ? parseFidelityDate(row["Completion date"])
    : null;

  return {
    broker: "fidelity",
    tradeDate,
    settleDate: settleDate && isValidDate(settleDate) ? settleDate : null,
    ticker: row["Symbol"]?.trim() || null,
    isin: null,
    instrument: investment === "Cash" ? null : investment || null,
    type,
    quantity,
    price: pricePerUnit,
    currency: row["Currency"]?.trim() || "GBP",
    fxRate: num(row["Exchange Rate"]),
    grossAmount: Math.abs(amount || 0),
    fees,
    netAmountGbp: Math.abs(amount || 0),
    notes: [
      row["Product Wrapper"]?.trim(),
      row["Reference Number"]?.trim() ? `Ref: ${row["Reference Number"].trim()}` : "",
    ].filter(Boolean).join(" | ") || null,
    rawRow: row,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────

const NORMALISERS: Record<BrokerKey, (row: Record<string, string>) => CanonicalTransaction | null> = {
  freetrade: normaliseFreetrade,
  trading212: normaliseTrading212,
  fidelity: normaliseFidelity,
};

export function useCsvNormaliser(broker: BrokerKey) {
  const normalise = useCallback(
    (rows: Record<string, string>[]): CanonicalTransaction[] => {
      const fn = NORMALISERS[broker];
      const results: CanonicalTransaction[] = [];
      let skipped = 0;

      for (const row of rows) {
        const txn = fn(row);
        if (txn && txn.grossAmount > 0) {
          results.push(txn);
        } else if (txn === null) {
          skipped++;
        }
      }

      if (skipped > 0) {
        console.log(`[${broker}] Skipped ${skipped} non-transaction rows`);
      }
      console.log(`[${broker}] Normalised ${results.length} transactions`);
      return results;
    },
    [broker]
  );

  return { normalise };
}

// Also export a standalone function for use outside React
export function normaliseRows(rows: Record<string, string>[], broker: BrokerKey): CanonicalTransaction[] {
  const fn = NORMALISERS[broker];
  return rows
    .map(fn)
    .filter((t): t is CanonicalTransaction => t !== null && t.grossAmount > 0);
}
