/**
 * Format a number as GBP currency.
 */
export function formatCurrency(
  value: number,
  currency = "GBP",
  opts?: { showSign?: boolean }
): string {
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (value < 0) return `(${formatted})`;
  if (opts?.showSign && value > 0) return `+${formatted}`;
  return formatted;
}

/**
 * Format a percentage with sign.
 */
export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a date as DD MMM YYYY.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Compact number formatting (e.g. 1.2k, 3.4M)
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
