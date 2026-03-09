/**
 * Broker-specific CSV field mapping constants.
 * Each broker defines its column names, type mappings, and detection headers.
 */

export type BrokerKey = "freetrade" | "fidelity" | "trading212";

export type CanonicalType =
  | "buy"
  | "sell"
  | "dividend"
  | "interest"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "other";

export interface CanonicalTransaction {
  broker: BrokerKey;
  tradeDate: string; // YYYY-MM-DD
  settleDate: string | null;
  ticker: string | null;
  isin: string | null;
  instrument: string | null;
  type: CanonicalType;
  quantity: number | null;
  price: number | null;
  currency: string;
  fxRate: number | null;
  grossAmount: number;
  fees: number;
  netAmountGbp: number;
  notes: string | null;
  rawRow: Record<string, string>;
}

// ─── Detection headers ──────────────────────────────────────────────

export const BROKER_DETECTION: Record<BrokerKey, string[]> = {
  trading212: ["Action", "Time", "ISIN", "No. of shares", "Price / share"],
  freetrade: ["Type", "Timestamp", "Title"],
  fidelity: ["Order date", "Completion date", "Transaction type", "Investments", "Amount"],
};

// ─── Type mappings ──────────────────────────────────────────────────

export const FREETRADE_TYPE_MAP: Record<string, CanonicalType> = {
  order: "buy",
  buy: "buy",
  sell: "sell",
  dividend: "dividend",
  property: "dividend", // REIT distributions
  interest: "interest",
  interest_from_cash: "interest",
  top_up: "deposit",
  withdrawal: "withdrawal",
  basic_order: "buy",
  "basic order": "buy",
};

export const FREETRADE_SKIP_TYPES = new Set([
  "monthly_statement",
  "monthly_share_lending_statement",
]);

export const TRADING212_TYPE_MAP: Record<string, CanonicalType> = {
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

export const FIDELITY_TYPE_MAP: Record<string, CanonicalType> = {
  buy: "buy",
  "buy from regular savings plan": "buy",
  sell: "sell",
  "cash in lump sum": "deposit",
  "cash in regular savings plan": "deposit",
  "cash out": "withdrawal",
  "cash interest": "interest",
  "service fee": "fee",
  "reinvestment from income": "dividend",
  dividend: "dividend",
  income: "dividend",
};

export const FIDELITY_SKIP_TYPES = new Set([
  "cash out for buy",
  "cash in",
  "transfer to cash management account for fees",
  "cash in ring-fenced for fees",
]);

// ─── Provider labels ────────────────────────────────────────────────

export const BROKER_LABELS: Record<BrokerKey, string> = {
  freetrade: "Freetrade",
  fidelity: "Fidelity",
  trading212: "Trading 212",
};
