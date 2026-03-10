import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PriceResult {
  ticker: string;
  price_gbp: number;
  price_native: number;
  currency: string;
  fx_rate: number;
}

async function fetchYahooPrice(ticker: string): Promise<PriceResult | null> {
  // UK-listed ETFs/stocks need .L suffix for Yahoo
  const yahooTicker = ticker.includes(".") ? ticker : `${ticker}.L`;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    console.error(`Yahoo returned ${res.status} for ${yahooTicker}`);
    return null;
  }

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;

  const price = meta.regularMarketPrice;
  const currency = (meta.currency || "GBP").toUpperCase();
  let fxRate = 1;
  let priceGbp = price;

  if (currency !== "GBP") {
    // Fetch FX rate
    const fxPair = `GBP${currency}=X`;
    const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${fxPair}?interval=1d&range=1d`;
    const fxRes = await fetch(fxUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (fxRes.ok) {
      const fxJson = await fxRes.json();
      const fxMeta = fxJson?.chart?.result?.[0]?.meta;
      if (fxMeta?.regularMarketPrice) {
        fxRate = fxMeta.regularMarketPrice;
        priceGbp = price / fxRate;
      }
    }
  }

  // Convert pence to pounds for GBX-quoted instruments
  if (currency === "GBX" || currency === "GBp") {
    priceGbp = price / 100;
    fxRate = 1;
  }

  return {
    ticker,
    price_gbp: priceGbp,
    price_native: price,
    currency,
    fx_rate: fxRate,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(
        JSON.stringify({ error: "tickers array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: PriceResult[] = [];
    const errors: { ticker: string; error: string }[] = [];

    // Process in batches of 5 to avoid rate limiting
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const promises = batch.map(async (ticker: string) => {
        try {
          const result = await fetchYahooPrice(ticker);
          if (result) {
            results.push(result);
          } else {
            errors.push({ ticker, error: "No price data returned" });
          }
        } catch (e: any) {
          errors.push({ ticker, error: e.message });
        }
      });
      await Promise.all(promises);

      // Small delay between batches
      if (i + 5 < tickers.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Upsert into instrument_prices
    if (results.length > 0) {
      const rows = results.map((r) => ({
        ticker: r.ticker,
        price_gbp: r.price_gbp,
        price_native: r.price_native,
        currency: r.currency,
        fx_rate: r.fx_rate,
        source: "yahoo",
        as_of: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from("instrument_prices")
        .upsert(rows, { onConflict: "ticker" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ updated: results.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
