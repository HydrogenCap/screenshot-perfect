/**
 * Import canonical transactions into Supabase with composite fingerprint deduplication.
 */

import { supabase } from "@/integrations/supabase/client";
import { CanonicalTransaction } from "@/lib/brokerMappings";

export interface ImportResult {
  inserted: number;
  duplicates: number;
  errors: string[];
}

/**
 * Generate a dedup hash from the composite fingerprint:
 * broker + trade_date + ticker + type + quantity + net_amount_gbp
 */
function dedupHash(txn: CanonicalTransaction): string {
  return [
    txn.broker,
    txn.tradeDate,
    txn.ticker || txn.instrument || "",
    txn.type,
    txn.quantity?.toFixed(8) || "0",
    txn.netAmountGbp.toFixed(4),
  ].join("|");
}

/**
 * Import transactions with deduplication and batch inserts.
 */
export async function importTransactions(
  txns: CanonicalTransaction[],
  userId: string,
  accountId: string,
  importId: string
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, duplicates: 0, errors: [] };

  if (txns.length === 0) return result;

  // Step 1: Generate dedup hashes for all incoming rows
  const hashMap = new Map<string, CanonicalTransaction>();
  for (const txn of txns) {
    const hash = dedupHash(txn);
    hashMap.set(hash, txn);
  }

  // Step 2: Check for existing duplicates by dedup_hash
  const allHashes = Array.from(hashMap.keys());
  const existingHashes = new Set<string>();

  // Query in batches of 100 to avoid URL length limits
  for (let i = 0; i < allHashes.length; i += 100) {
    const batch = allHashes.slice(i, i + 100);
    const { data } = await supabase
      .from("transactions")
      .select("dedup_hash")
      .eq("account_id", accountId)
      .in("dedup_hash", batch);

    if (data) {
      for (const row of data) {
        if (row.dedup_hash) existingHashes.add(row.dedup_hash);
      }
    }
  }

  // Step 3: Filter out duplicates
  const newTxns: Array<{ txn: CanonicalTransaction; hash: string }> = [];
  for (const [hash, txn] of hashMap) {
    if (existingHashes.has(hash)) {
      result.duplicates++;
    } else {
      newTxns.push({ txn, hash });
    }
  }

  if (newTxns.length === 0) return result;

  // Step 4: Ensure instruments exist
  const instrumentCache: Record<string, string> = {};
  for (const { txn } of newTxns) {
    if (!txn.isin && !txn.instrument) continue;
    if (["deposit", "withdrawal", "interest", "fee"].includes(txn.type)) continue;

    const cacheKey = txn.isin || txn.instrument || "";
    if (instrumentCache[cacheKey]) continue;

    let query = supabase.from("instruments").select("id").eq("user_id", userId);
    if (txn.isin) query = query.eq("isin", txn.isin);
    else if (txn.instrument) query = query.eq("name", txn.instrument);

    const { data: existing } = await query.maybeSingle();
    if (existing) {
      instrumentCache[cacheKey] = existing.id;
    } else {
      const { data: newInst, error: instErr } = await supabase
        .from("instruments")
        .insert({
          user_id: userId,
          name: txn.instrument || txn.ticker || txn.isin || "Unknown",
          ticker: txn.ticker,
          isin: txn.isin,
          currency: txn.currency,
        })
        .select("id")
        .single();

      if (instErr) {
        result.errors.push(`Instrument creation failed: ${instErr.message}`);
        continue;
      }
      instrumentCache[cacheKey] = newInst.id;
    }
  }

  // Step 5: Batch insert transactions (100 per batch)
  const BATCH_SIZE = 100;
  for (let i = 0; i < newTxns.length; i += BATCH_SIZE) {
    const batch = newTxns.slice(i, i + BATCH_SIZE);
    const rows = batch.map(({ txn, hash }) => {
      const cacheKey = txn.isin || txn.instrument || "";
      const instrumentId = instrumentCache[cacheKey] || null;
      const needsInstrument = !["deposit", "withdrawal", "interest", "fee"].includes(txn.type);

      return {
        account_id: accountId,
        transaction_date: txn.tradeDate,
        settlement_date: txn.settleDate,
        type: txn.type as any,
        quantity: txn.quantity,
        price_per_unit: txn.price,
        total_amount: txn.netAmountGbp,
        fees: txn.fees,
        currency: txn.currency,
        fx_rate: txn.fxRate,
        instrument_id: needsInstrument ? instrumentId : null,
        import_id: importId,
        dedup_hash: hash,
        notes: txn.notes,
      };
    });

    const { error, data } = await supabase
      .from("transactions")
      .insert(rows)
      .select("id");

    if (error) {
      result.errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    } else {
      result.inserted += data?.length || 0;
    }
  }

  return result;
}
