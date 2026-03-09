
-- Step 1: portfolio_holdings view (adapted to actual schema)
CREATE OR REPLACE VIEW public.portfolio_holdings AS
SELECT
  a.user_id,
  i.id AS instrument_id,
  i.ticker,
  i.isin,
  i.name AS instrument_name,
  a.account_type,
  a.id AS account_id,
  a.account_name,
  SUM(CASE WHEN t.type = 'buy' THEN COALESCE(t.quantity, 0) ELSE 0 END)
  - SUM(CASE WHEN t.type = 'sell' THEN COALESCE(t.quantity, 0) ELSE 0 END) AS net_quantity,
  SUM(CASE WHEN t.type = 'buy' THEN ABS(t.total_amount) ELSE 0 END) AS total_cost,
  CASE
    WHEN (SUM(CASE WHEN t.type = 'buy' THEN COALESCE(t.quantity, 0) ELSE 0 END)
        - SUM(CASE WHEN t.type = 'sell' THEN COALESCE(t.quantity, 0) ELSE 0 END)) > 0
    THEN SUM(CASE WHEN t.type = 'buy' THEN ABS(t.total_amount) ELSE 0 END)
       / NULLIF(
           SUM(CASE WHEN t.type = 'buy' THEN COALESCE(t.quantity, 0) ELSE 0 END)
         - SUM(CASE WHEN t.type = 'sell' THEN COALESCE(t.quantity, 0) ELSE 0 END),
           0)
    ELSE 0
  END AS avg_cost,
  MAX(t.transaction_date) AS last_trade_date
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
LEFT JOIN public.instruments i ON i.id = t.instrument_id
WHERE t.type IN ('buy', 'sell')
GROUP BY a.user_id, i.id, i.ticker, i.isin, i.name, a.account_type, a.id, a.account_name
HAVING
  SUM(CASE WHEN t.type = 'buy' THEN COALESCE(t.quantity, 0) ELSE 0 END)
- SUM(CASE WHEN t.type = 'sell' THEN COALESCE(t.quantity, 0) ELSE 0 END) > 0;

-- Step 2: instrument_prices table
CREATE TABLE public.instrument_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text UNIQUE NOT NULL,
  isin text,
  instrument_name text,
  price_gbp numeric(18,8) NOT NULL DEFAULT 0,
  currency text DEFAULT 'GBP',
  fx_rate numeric(18,8) DEFAULT 1,
  price_native numeric(18,8),
  source text DEFAULT 'manual',
  as_of timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.instrument_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prices"
  ON public.instrument_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert prices"
  ON public.instrument_prices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update prices"
  ON public.instrument_prices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Step 3: manual_valuations table
CREATE TABLE public.manual_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  ticker text,
  valuation_gbp numeric(18,4) NOT NULL,
  valuation_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.manual_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own manual valuations"
  ON public.manual_valuations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
