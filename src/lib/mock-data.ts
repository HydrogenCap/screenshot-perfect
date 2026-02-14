// Data labels and helpers — no mock data

export const portfolioStats = {
  totalValue: 0,
  netContributions: 0,
  unrealisedPL: 0,
  unrealisedPLPercent: 0,
  totalDividends: 0,
  totalInterest: 0,
};

export const portfolioHistory: { date: string; value: number; contributions: number }[] = [];

export const allocationByProvider: { name: string; value: number; color: string }[] = [];
export const allocationByType: { name: string; value: number; color: string }[] = [];
export const allocationByAssetClass: { name: string; value: number; color: string }[] = [];

export const monthlyCashFlow: { month: string; deposits: number; withdrawals: number }[] = [];

export const recentTransactions: {
  id: string; date: string; account: string; type: string;
  instrument: string | null; amount: number; quantity: number | null;
}[] = [];

export const mockAccounts: {
  id: string; provider: string; name: string; type: string;
  lastImport: string | null; value: number; cash: number; invested: number; active: boolean;
}[] = [];

export const accountTypeLabels: Record<string, string> = {
  stocks_and_shares_isa: "S&S ISA",
  cash_isa: "Cash ISA",
  lifetime_isa: "LISA",
  junior_isa: "Junior ISA",
  sipp: "SIPP",
  workplace_pension: "Workplace Pension",
  gia: "GIA",
  trading_account: "Trading",
  savings_account: "Savings",
  current_account: "Current Account",
  cash_savings: "Cash Savings",
  crypto: "Crypto",
  other: "Other",
};