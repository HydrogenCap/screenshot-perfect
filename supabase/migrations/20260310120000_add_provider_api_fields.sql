-- Add API integration columns to providers
ALTER TABLE public.providers
  ADD COLUMN api_key TEXT,
  ADD COLUMN api_environment TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN last_synced_at TIMESTAMPTZ,
  ADD COLUMN sync_status TEXT;

-- Add unique index on holdings so we can upsert by (account, instrument)
CREATE UNIQUE INDEX idx_holdings_position
  ON public.holdings (account_id, instrument_id)
  WHERE instrument_id IS NOT NULL;
