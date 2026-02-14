// Mock data for dashboard development before backend is wired up

export const portfolioStats = {
  totalValue: 87432.56,
  netContributions: 62500.0,
  unrealisedPL: 18932.56,
  unrealisedPLPercent: 27.7,
  totalDividends: 3420.12,
  totalInterest: 580.34,
};

export const portfolioHistory = [
  { date: "2024-01", value: 52000, contributions: 50000 },
  { date: "2024-02", value: 54200, contributions: 51500 },
  { date: "2024-03", value: 56800, contributions: 53000 },
  { date: "2024-04", value: 55100, contributions: 54500 },
  { date: "2024-05", value: 58900, contributions: 56000 },
  { date: "2024-06", value: 61200, contributions: 57500 },
  { date: "2024-07", value: 63800, contributions: 58000 },
  { date: "2024-08", value: 65400, contributions: 59000 },
  { date: "2024-09", value: 68200, contributions: 59500 },
  { date: "2024-10", value: 72100, contributions: 60000 },
  { date: "2024-11", value: 78600, contributions: 61000 },
  { date: "2024-12", value: 82300, contributions: 61500 },
  { date: "2025-01", value: 87432, contributions: 62500 },
];

export const allocationByProvider = [
  { name: "Trading212", value: 34200, color: "hsl(var(--chart-1))" },
  { name: "Fidelity", value: 22100, color: "hsl(var(--chart-2))" },
  { name: "Chip", value: 15800, color: "hsl(var(--chart-3))" },
  { name: "Vanguard", value: 12332, color: "hsl(var(--chart-4))" },
  { name: "Monzo", value: 3000, color: "hsl(var(--chart-5))" },
];

export const allocationByType = [
  { name: "S&S ISA", value: 42000, color: "hsl(var(--chart-1))" },
  { name: "SIPP", value: 18500, color: "hsl(var(--chart-2))" },
  { name: "Cash Savings", value: 15800, color: "hsl(var(--chart-3))" },
  { name: "GIA", value: 8132, color: "hsl(var(--chart-4))" },
  { name: "Current Account", value: 3000, color: "hsl(var(--chart-5))" },
];

export const allocationByAssetClass = [
  { name: "ETF", value: 38500, color: "hsl(var(--chart-1))" },
  { name: "Equity", value: 18200, color: "hsl(var(--chart-2))" },
  { name: "Fund", value: 12400, color: "hsl(var(--chart-3))" },
  { name: "Cash", value: 15800, color: "hsl(var(--chart-4))" },
  { name: "Bond", value: 2532, color: "hsl(var(--chart-5))" },
];

export const monthlyCashFlow = [
  { month: "Jul", deposits: 1500, withdrawals: 0 },
  { month: "Aug", deposits: 1000, withdrawals: 200 },
  { month: "Sep", deposits: 500, withdrawals: 0 },
  { month: "Oct", deposits: 500, withdrawals: 0 },
  { month: "Nov", deposits: 1000, withdrawals: 500 },
  { month: "Dec", deposits: 500, withdrawals: 0 },
  { month: "Jan", deposits: 1500, withdrawals: 0 },
];

export const recentTransactions = [
  { id: "1", date: "2025-01-14", account: "Trading212 ISA", type: "buy", instrument: "VWRL", amount: 820.5, quantity: 8 },
  { id: "2", date: "2025-01-12", account: "Trading212 ISA", type: "dividend", instrument: "AAPL", amount: 12.34, quantity: null },
  { id: "3", date: "2025-01-10", account: "Chip Savings", type: "deposit", instrument: null, amount: 500.0, quantity: null },
  { id: "4", date: "2025-01-08", account: "Fidelity SIPP", type: "buy", instrument: "FTSE Global", amount: 1000.0, quantity: 42 },
  { id: "5", date: "2025-01-05", account: "Trading212 ISA", type: "buy", instrument: "SMT", amount: 450.0, quantity: 35 },
  { id: "6", date: "2025-01-03", account: "Vanguard ISA", type: "interest", instrument: null, amount: 23.45, quantity: null },
  { id: "7", date: "2024-12-28", account: "Trading212 GIA", type: "sell", instrument: "TSLA", amount: 1200.0, quantity: 5 },
  { id: "8", date: "2024-12-22", account: "Chip Savings", type: "interest", instrument: null, amount: 18.72, quantity: null },
];

export const mockAccounts = [
  { id: "1", provider: "Trading212", name: "ISA 2024/25", type: "stocks_and_shares_isa", lastImport: "2025-01-14", value: 24230, cash: 320, invested: 23910, active: true },
  { id: "2", provider: "Trading212", name: "GIA", type: "gia", lastImport: "2025-01-14", value: 9970, cash: 150, invested: 9820, active: true },
  { id: "3", provider: "Fidelity", name: "SIPP", type: "sipp", lastImport: "2025-01-08", value: 22100, cash: 1200, invested: 20900, active: true },
  { id: "4", provider: "Chip", name: "Easy Access Savings", type: "cash_savings", lastImport: "2025-01-10", value: 15800, cash: 15800, invested: 0, active: true },
  { id: "5", provider: "Vanguard", name: "ISA", type: "stocks_and_shares_isa", lastImport: "2024-12-20", value: 12332, cash: 0, invested: 12332, active: true },
  { id: "6", provider: "Monzo", name: "Current Account", type: "current_account", lastImport: null, value: 3000, cash: 3000, invested: 0, active: true },
];

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
