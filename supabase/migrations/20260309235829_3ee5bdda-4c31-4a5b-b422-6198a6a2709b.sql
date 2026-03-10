
-- Fix 1: Make portfolio_holdings view use SECURITY INVOKER
ALTER VIEW public.portfolio_holdings SET (security_invoker = on);

-- Fix 2: Tighten instrument_prices INSERT/UPDATE policies
-- Drop permissive policies
DROP POLICY "Authenticated users can insert prices" ON public.instrument_prices;
DROP POLICY "Authenticated users can update prices" ON public.instrument_prices;

-- Restrict write to service role only (edge function uses service role)
-- Authenticated users can only read
