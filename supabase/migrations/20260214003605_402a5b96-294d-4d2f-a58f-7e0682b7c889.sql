
-- Enums
CREATE TYPE public.provider_type AS ENUM ('bank', 'investment_platform', 'pension_provider', 'crypto_exchange', 'savings_platform');
CREATE TYPE public.account_type AS ENUM ('stocks_and_shares_isa', 'cash_isa', 'lifetime_isa', 'junior_isa', 'sipp', 'workplace_pension', 'gia', 'trading_account', 'savings_account', 'current_account', 'cash_savings', 'crypto', 'other');
CREATE TYPE public.asset_class AS ENUM ('equity', 'etf', 'fund', 'investment_trust', 'bond', 'gilt', 'cash', 'commodity', 'crypto', 'property', 'alternative', 'other');
CREATE TYPE public.transaction_type AS ENUM ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'fee', 'transfer_in', 'transfer_out', 'corporate_action', 'stock_split', 'fx_conversion', 'contribution', 'tax_relief', 'other');
CREATE TYPE public.import_status AS ENUM ('pending', 'previewing', 'confirmed', 'failed', 'rolled_back');
CREATE TYPE public.valuation_source AS ENUM ('import', 'manual', 'calculated');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  base_currency text NOT NULL DEFAULT 'GBP',
  tax_year_start_month integer NOT NULL DEFAULT 4,
  tax_year_start_day integer NOT NULL DEFAULT 6,
  isa_limit numeric NOT NULL DEFAULT 20000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Providers
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider_type public.provider_type NOT NULL DEFAULT 'investment_platform',
  logo_url text,
  website_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own providers" ON public.providers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CSV Mappings
CREATE TABLE public.csv_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  mapping_name text NOT NULL,
  column_map jsonb NOT NULL DEFAULT '{}',
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  decimal_separator text NOT NULL DEFAULT '.',
  skip_header_rows integer NOT NULL DEFAULT 0,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.csv_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mappings" ON public.csv_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_type public.account_type NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  account_reference text,
  is_active boolean NOT NULL DEFAULT true,
  opened_date date,
  tax_year_contribution numeric NOT NULL DEFAULT 0,
  contribution_limit numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Instruments
CREATE TABLE public.instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker text,
  isin text,
  name text NOT NULL,
  asset_class public.asset_class NOT NULL DEFAULT 'other',
  asset_sub_class text,
  currency text NOT NULL DEFAULT 'GBP',
  exchange text,
  sedol text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own instruments" ON public.instruments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_instruments_isin ON public.instruments (user_id, isin) WHERE isin IS NOT NULL;
CREATE UNIQUE INDEX idx_instruments_ticker ON public.instruments (user_id, ticker, exchange) WHERE ticker IS NOT NULL AND exchange IS NOT NULL;

-- Imports
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text,
  file_size integer,
  row_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status public.import_status NOT NULL DEFAULT 'pending',
  mapping_used uuid REFERENCES public.csv_mappings(id) ON DELETE SET NULL,
  error_log jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own imports" ON public.imports FOR ALL
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES public.instruments(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  settlement_date date,
  type public.transaction_type NOT NULL,
  quantity numeric,
  price_per_unit numeric,
  total_amount numeric NOT NULL,
  fees numeric NOT NULL DEFAULT 0,
  stamp_duty numeric NOT NULL DEFAULT 0,
  fx_rate numeric,
  currency text NOT NULL DEFAULT 'GBP',
  reference text,
  notes text,
  import_id uuid REFERENCES public.imports(id) ON DELETE SET NULL,
  dedup_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE UNIQUE INDEX idx_transactions_dedup ON public.transactions (dedup_hash) WHERE dedup_hash IS NOT NULL;

-- Holdings
CREATE TABLE public.holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES public.instruments(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  cost_basis numeric NOT NULL DEFAULT 0,
  average_cost_per_unit numeric NOT NULL DEFAULT 0,
  current_price numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  last_updated timestamptz NOT NULL DEFAULT now(),
  notes text
);
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own holdings" ON public.holdings FOR ALL
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Valuations
CREATE TABLE public.valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  valuation_date date NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  cash_balance numeric NOT NULL DEFAULT 0,
  invested_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  source public.valuation_source NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own valuations" ON public.valuations FOR ALL
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE UNIQUE INDEX idx_valuations_date ON public.valuations (account_id, valuation_date);

-- Exchange Rates
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  rate_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read rates" ON public.exchange_rates FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE UNIQUE INDEX idx_exchange_rates ON public.exchange_rates (from_currency, to_currency, rate_date);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
