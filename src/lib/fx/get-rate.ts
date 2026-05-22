import { getServerSupabase } from '@/lib/supabase/local-client';

interface FxLookup {
  rate: number;
  fetchedAt: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Conservative offline fallback rates so the engine still works without a live
// FX API. These are intentionally coarse and only kick in when both the cache
// and the upstream API are unavailable.
const FALLBACK_TO_JPY: Record<string, number> = {
  AUD: 100,
  USD: 155,
  GBP: 195,
  CAD: 113,
  NZD: 92,
  EUR: 165,
  PHP: 2.7,
  JPY: 1,
};

/**
 * Returns the conversion rate `1 sourceCurrency => N JPY`.
 *
 * Strategy:
 *  1. Check the `fx_rates` table; if it was fetched within the last 24h, use it.
 *  2. Otherwise hit exchangerate.host (no key required) and upsert.
 *  3. If both fail, fall back to a conservative hard-coded constant so the UI
 *     still renders something useful and we never block on FX.
 */
export async function getJpyConversion(sourceCurrency: string): Promise<FxLookup> {
  const ccy = sourceCurrency.toUpperCase();
  if (ccy === 'JPY') {
    return { rate: 1, fetchedAt: new Date().toISOString() };
  }

  const supabase = getServerSupabase();

  const { data: cached } = await supabase
    .from('fx_rates')
    .select('rate, fetched_at')
    .eq('base', ccy)
    .eq('quote', 'JPY')
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < ONE_DAY_MS) {
    return { rate: Number(cached.rate), fetchedAt: cached.fetched_at };
  }

  try {
    const live = await fetchLiveRate(ccy);
    await supabase.from('fx_rates').upsert(
      {
        base: ccy,
        quote: 'JPY',
        rate: live,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'base,quote' },
    );
    return { rate: live, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.warn('[fx] live fetch failed, using fallback', err);
    const fallback = FALLBACK_TO_JPY[ccy];
    if (!fallback) {
      throw new Error(`No FX rate available for ${ccy} -> JPY.`);
    }
    return {
      rate: fallback,
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function fetchLiveRate(sourceCurrency: string): Promise<number> {
  // Frankfurter is free, no API key required, ECB-backed mid-market rates.
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(
    sourceCurrency,
  )}&to=JPY`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const json = (await res.json()) as { rates?: { JPY?: number } };
  const rate = json.rates?.JPY;
  if (!rate || rate <= 0) {
    throw new Error('FX response missing JPY rate');
  }
  return rate;
}
