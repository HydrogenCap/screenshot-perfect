import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PortfolioHolding {
  instrument_id: string | null;
  ticker: string | null;
  isin: string | null;
  instrument_name: string | null;
  account_type: string;
  account_id: string;
  account_name: string;
  net_quantity: number;
  total_cost: number;
  avg_cost: number;
  last_trade_date: string;
  // Joined from instrument_prices
  current_price: number | null;
  price_currency: string | null;
  price_as_of: string | null;
  // Computed
  market_value: number;
  gain_loss: number;
  gain_loss_pct: number;
}

export function usePortfolioHoldings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolio-holdings"],
    queryFn: async (): Promise<PortfolioHolding[]> => {
      // Fetch holdings view
      const { data: holdings, error: hErr } = await supabase
        .from("portfolio_holdings" as any)
        .select("*")
        .eq("user_id", user!.id);
      if (hErr) throw hErr;
      if (!holdings?.length) return [];

      // Fetch all prices
      const { data: prices } = await supabase
        .from("instrument_prices")
        .select("ticker, price_gbp, currency, as_of");

      const priceMap = new Map<string, { price_gbp: number; currency: string; as_of: string }>();
      (prices || []).forEach((p: any) => {
        priceMap.set(p.ticker, { price_gbp: p.price_gbp, currency: p.currency, as_of: p.as_of });
      });

      return (holdings as any[]).map((h) => {
        const price = h.ticker ? priceMap.get(h.ticker) : null;
        const currentPrice = price ? Number(price.price_gbp) : null;
        const netQty = Number(h.net_quantity);
        const totalCost = Number(h.total_cost);
        const marketValue = currentPrice != null ? netQty * currentPrice : 0;
        const gainLoss = currentPrice != null ? marketValue - totalCost : 0;
        const gainLossPct = currentPrice != null && totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

        return {
          instrument_id: h.instrument_id,
          ticker: h.ticker,
          isin: h.isin,
          instrument_name: h.instrument_name,
          account_type: h.account_type,
          account_id: h.account_id,
          account_name: h.account_name,
          net_quantity: netQty,
          total_cost: totalCost,
          avg_cost: Number(h.avg_cost),
          last_trade_date: h.last_trade_date,
          current_price: currentPrice,
          price_currency: price?.currency || null,
          price_as_of: price?.as_of || null,
          market_value: marketValue,
          gain_loss: gainLoss,
          gain_loss_pct: gainLossPct,
        };
      });
    },
    enabled: !!user,
  });
}

export function useRefreshPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tickers: string[]) => {
      if (tickers.length === 0) return { updated: 0, errors: [] };

      const { data, error } = await supabase.functions.invoke("fetch-prices", {
        body: { tickers },
      });

      if (error) throw error;
      return data as { updated: number; errors: { ticker: string; error: string }[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-value"] });
    },
  });
}
