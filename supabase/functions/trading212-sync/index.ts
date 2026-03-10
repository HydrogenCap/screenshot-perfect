import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CashResponse {
  free: number;
  invested: number;
  result: number;
  total: number;
  pieCash: number;
  blocked: number;
}

interface Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number;
  initialFillDate: string;
  frontend: string;
}

/** Parse T212 ticker format e.g. "AAPL_US_EQ", "VUSA_EQ", "BTC_USD_CRYPT" */
function parseT212Ticker(ticker: string): {
  symbol: string;
  assetClass: "equity" | "etf" | "crypto" | "other";
} {
  const parts = ticker.split("_");
  const symbol = parts[0];
  const last = parts[parts.length - 1];

  let assetClass: "equity" | "etf" | "crypto" | "other" = "equity";
  if (last === "EQ" || last === "EQ_H") assetClass = "equity";
  else if (last === "ETF") assetClass = "etf";
  else if (last === "CRYPT") assetClass = "crypto";
  else assetClass = "other";

  return { symbol, assetClass };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider_id } = await req.json();

    if (!provider_id) {
      return new Response(
        JSON.stringify({ error: "provider_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create client with user's JWT so RLS is enforced
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load provider (RLS ensures it belongs to this user)
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, name, api_key, api_environment")
      .eq("id", provider_id)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ error: "Provider not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!provider.api_key) {
      return new Response(
        JSON.stringify({ error: "No API key configured for this provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = provider.api_environment === "demo"
      ? "https://demo.trading212.com/api/v0"
      : "https://live.trading212.com/api/v0";

    const t212Headers = { Authorization: provider.api_key };

    // ── 1. Account cash summary ─────────────────────────────────────────────
    const cashResp = await fetch(`${baseUrl}/equity/account/cash`, { headers: t212Headers });

    if (!cashResp.ok) {
      const errText = await cashResp.text();
      await supabase.from("providers").update({
        sync_status: `Error ${cashResp.status}: ${errText.slice(0, 150)}`,
        last_synced_at: new Date().toISOString(),
      }).eq("id", provider_id);

      return new Response(
        JSON.stringify({ error: `Trading 212 API error: ${cashResp.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cashData: CashResponse = await cashResp.json();

    // ── 2. Find accounts for this provider ──────────────────────────────────
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, account_name, is_active")
      .eq("provider_id", provider_id)
      .order("created_at", { ascending: true });

    const activeAccounts = (accounts ?? []).filter((a: any) => a.is_active);
    const targetAccount = activeAccounts[0] ?? null;

    let valuationsCreated = 0;

    if (targetAccount) {
      const today = new Date().toISOString().slice(0, 10);
      const { error: valError } = await supabase.from("valuations").upsert({
        account_id: targetAccount.id,
        valuation_date: today,
        total_value: cashData.total,
        cash_balance: cashData.free,
        invested_value: cashData.total - cashData.free,
        source: "import",
      }, { onConflict: "account_id,valuation_date" });

      if (!valError) valuationsCreated++;
    }

    // ── 3. Portfolio positions (T212 rate limit: respect ~1 req/sec) ────────
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const portfolioResp = await fetch(`${baseUrl}/equity/portfolio`, { headers: t212Headers });

    let holdingsSynced = 0;

    if (portfolioResp.ok && targetAccount) {
      const positions: Position[] = await portfolioResp.json();

      for (const pos of positions) {
        const { symbol, assetClass } = parseT212Ticker(pos.ticker);

        // Find or create instrument keyed by (user_id, ticker="T212:AAPL_US_EQ", exchange="T212")
        const t212Ticker = `T212:${pos.ticker}`;
        let instrumentId: string | null = null;

        const { data: existing } = await supabase
          .from("instruments")
          .select("id")
          .eq("ticker", t212Ticker)
          .eq("exchange", "T212")
          .maybeSingle();

        if (existing) {
          instrumentId = existing.id;
          // Keep current_price up to date on the instrument
          await supabase.from("instruments")
            .update({ notes: `Synced from Trading 212 · price: ${pos.currentPrice}` })
            .eq("id", instrumentId);
        } else {
          const { data: created } = await supabase
            .from("instruments")
            .insert({
              user_id: user.id,
              ticker: t212Ticker,
              name: symbol,
              exchange: "T212",
              asset_class: assetClass,
              currency: "GBP",
              notes: "Synced from Trading 212",
            })
            .select("id")
            .single();

          if (created) instrumentId = created.id;
        }

        if (instrumentId) {
          const { error: holdingError } = await supabase.from("holdings").upsert({
            account_id: targetAccount.id,
            instrument_id: instrumentId,
            quantity: pos.quantity,
            average_cost_per_unit: pos.averagePrice,
            cost_basis: pos.quantity * pos.averagePrice,
            current_price: pos.currentPrice,
            current_value: pos.quantity * pos.currentPrice,
            last_updated: new Date().toISOString(),
          }, { onConflict: "account_id,instrument_id" });

          if (!holdingError) holdingsSynced++;
        }
      }
    }

    // ── 4. Mark provider as synced ──────────────────────────────────────────
    await supabase.from("providers").update({
      last_synced_at: new Date().toISOString(),
      sync_status: "ok",
    }).eq("id", provider_id);

    return new Response(
      JSON.stringify({
        success: true,
        portfolio_value: cashData.total,
        cash: cashData.free,
        invested: cashData.total - cashData.free,
        valuations_created: valuationsCreated,
        holdings_synced: holdingsSynced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
