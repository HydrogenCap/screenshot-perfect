/**
 * CSV parser definitions for Trading212 and Freetrade.
 * Each parser maps raw CSV rows into a normalised ParsedTransaction shape.
 */

export interface ParsedTransaction {
  date: string; // ISO date string YYYY-MM-DD
  type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "interest" | "fee" | "other";
  ticker: string | null;
  isin: string | null;
  name: string | null;
  quantity: number | null;
  pricePerUnit: number | null;
  totalAmount: number;
  fees: number;
  currency: string;
  fxRate: number | null;
  notes: string | null;
  rawAction: string; // original action/type string from CSV
}

export type ProviderFormat = "trading212" | "freetrade" | "fidelity" | "unknown";

// ─── Detection ───────────────────────────────────────────────────────

const T212_REQUIRED = ["Action", "Time", "ISIN", "No. of shares", "Price / share"];
const FT_REQUIRED = ["Type", "Timestamp", "Title"];
const FIDELITY_REQUIRED = ["Order date", "Completion date", "Transaction type", "Investments", "Amount"];

export function detectProvider(headers: string[]): ProviderFormat {
  const normalised = headers.map((h) => h.trim());
  if (T212_REQUIRED.every((r) => normalised.includes(r))) return "trading212";
  if (FT_REQUIRED.every((r) => normalised.includes(r))) return "freetrade";
  if (FIDELITY_REQUIRED.every((r) => normalised.includes(r))) return "fidelity";
  return "unknown";
}

/**
 * Fidelity CSVs have metadata rows before the actual header.
 * This function strips them and returns clean CSV text.
 */
export function preprocessCSV(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  // Find the line that looks like the real header (contains "Order date")
  const headerIdx = lines.findIndex((l) => l.includes("Order date") && l.includes("Transaction type"));
  if (headerIdx > 0) {
    return lines.slice(headerIdx).join("\n");
  }
  return rawText;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function num(val: string | undefined | null): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(raw: string): string {
  // Trading212: "2024-01-15 10:30:45" or ISO
  // Freetrade:  "2024-01-15T10:30:45.000Z" or similar
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toISOString().split("T")[0];
  } catch {
    return raw;
  }
}

// ─── Trading212 ──────────────────────────────────────────────────────

const T212_ACTION_MAP: Record<string, ParsedTransaction["type"]> = {
  "market buy": "buy",
  "limit buy": "buy",
  "stop buy": "buy",
  "market sell": "sell",
  "limit sell": "sell",
  "stop sell": "sell",
  deposit: "deposit",
  withdrawal: "withdrawal",
  "dividend (ordinary)": "dividend",
  "dividend (return of capital)": "dividend",
  "dividend (bonus)": "dividend",
  "interest on cash": "interest",
};

function parseTrading212Row(row: Record<string, string>): ParsedTransaction | null {
  const action = (row["Action"] || "").trim();
  const actionLower = action.toLowerCase();

  // Skip rows we can't map (e.g. "Currency conversion", card funding notes)
  const type = T212_ACTION_MAP[actionLower] || "other";

  const totalCol =
    row["Total (GBP)"] ?? row["Total (EUR)"] ?? row["Total (USD)"] ?? row["Total"] ?? "";
  const resultCol =
    row["Result (GBP)"] ?? row["Result (EUR)"] ?? row["Result (USD)"] ?? row["Result"] ?? "";

  // Detect currency from header like "Total (GBP)"
  const totalHeader = Object.keys(row).find((k) => k.startsWith("Total ("));
  const currency = totalHeader ? totalHeader.match(/\((\w+)\)/)?.[1] || "GBP" : "GBP";

  const chargeCol =
    row["Charge amount (GBP)"] ?? row["Charge amount (EUR)"] ?? row["Charge amount (USD)"] ?? "";
  const fxFeeCol =
    row["Currency conversion fee (GBP)"] ??
    row["Currency conversion fee (EUR)"] ??
    row["Currency conversion fee (USD)"] ??
    "";

  const fees = (num(chargeCol) || 0) + (num(fxFeeCol) || 0);
  const total = num(totalCol) || 0;

  return {
    date: parseDate(row["Time"] || ""),
    type,
    ticker: row["Ticker"]?.trim() || null,
    isin: row["ISIN"]?.trim() || null,
    name: row["Name"]?.trim() || null,
    quantity: num(row["No. of shares"]),
    pricePerUnit: num(row["Price / share"]),
    totalAmount: Math.abs(total),
    fees,
    currency,
    fxRate: num(row["Exchange rate"]),
    notes: [row["Notes"], resultCol ? `Result: ${resultCol}` : ""].filter(Boolean).join(" | ") || null,
    rawAction: action,
  };
}

// ─── Freetrade ───────────────────────────────────────────────────────

const FT_TYPE_MAP: Record<string, ParsedTransaction["type"]> = {
  order: "buy",
  buy: "buy",
  sell: "sell",
  dividend: "dividend",
  property: "dividend", // REIT distributions
  interest: "interest",
  interest_from_cash: "interest",
  top_up: "deposit",
  withdrawal: "withdrawal",
  "basic order": "buy",
  "basic_order": "buy",
};

// Types to skip entirely (no financial transaction)
const FT_SKIP_TYPES = new Set([
  "monthly_statement",
  "monthly_share_lending_statement",
]);

function parseFreetradeRow(row: Record<string, string>): ParsedTransaction | null {
  const rawType = (row["Type"] || "").trim();
  const typeLower = rawType.toLowerCase().replace(/\s+/g, "_");

  // Skip non-transaction rows
  if (FT_SKIP_TYPES.has(typeLower)) return null;

  let type: ParsedTransaction["type"] = FT_TYPE_MAP[typeLower] || "other";

  // Refine buy/sell from "Buy / Sell" column
  const buySell = (row["Buy / Sell"] || "").trim().toLowerCase();
  if (buySell === "sell") type = "sell";
  else if (buySell === "buy") type = "buy";

  // Use the correct column names from actual Freetrade CSV
  const total = num(row["Total Amount in Account Currency"]) || num(row["Total Amount"]) || num(row["Subtotal"]) || 0;
  const stampDuty = num(row["Stamp Duty"]) || 0;
  const fxFeeAmount = num(row["FX Fee Amount"]) || 0;
  const fees = stampDuty + fxFeeAmount;
  const currency = row["Account Currency"]?.trim() || row["Currency"]?.trim() || "GBP";

  return {
    date: parseDate(row["Timestamp"] || ""),
    type,
    ticker: row["Ticker"]?.trim() || null,
    isin: row["ISIN"]?.trim() || null,
    name: row["Title"]?.trim() || null,
    quantity: num(row["Quantity"]),
    pricePerUnit: num(row["Price per Share in Account Currency"] || row["Price per Share"] || row["Price per share"]),
    totalAmount: Math.abs(total),
    fees,
    currency,
    fxRate: num(row["FX Rate"] || row["Base FX Rate"]),
    notes: row["Notes"]?.trim() || null,
    rawAction: rawType,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export function parseRows(
  rows: Record<string, string>[],
  provider: ProviderFormat
): ParsedTransaction[] {
  const parser = provider === "trading212" ? parseTrading212Row : parseFreetradeRow;
  return rows
    .map(parser)
    .filter((t): t is ParsedTransaction => t !== null && t.totalAmount > 0);
}

export function providerLabel(provider: ProviderFormat): string {
  switch (provider) {
    case "trading212": return "Trading212";
    case "freetrade": return "Freetrade";
    default: return "Unknown";
  }
}
