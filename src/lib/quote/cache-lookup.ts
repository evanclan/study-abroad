import { getServerSupabase } from '@/lib/supabase/local-client';
import type { Database } from '@/lib/supabase/database.types';
import type { QuoteParams } from '@/types/quote';

export type QuoteCacheRow = Database['public']['Tables']['quote_cache']['Row'];

const FRESHNESS_DAYS = 30;
const FRESHNESS_MS = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

export interface CacheHit {
  row: QuoteCacheRow;
  isFresh: boolean;
  ageDays: number;
}

/**
 * Look up the most-recently-updated cache row matching the parsed params.
 * Returns null on a cold miss; returns a hit with `isFresh: false` if a row
 * exists but is older than 30 days (so the orchestrator still does a live
 * refresh, but can also show a stale fallback if scraping fails).
 */
export async function lookupQuoteCache(
  params: QuoteParams,
): Promise<CacheHit | null> {
  const supabase = getServerSupabase();

  let query = supabase
    .from('quote_cache')
    .select('*')
    .eq('country_code', params.countryCode)
    .eq('course_slug', params.courseSlug)
    .eq('age_bracket', params.ageBracket)
    .eq('duration_months', params.durationMonths)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (params.schoolName) {
    query = query.ilike('school_name', `%${params.schoolName}%`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn('[cache] lookup error', error);
    return null;
  }
  if (!data) return null;

  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  const isFresh = ageMs < FRESHNESS_MS;
  return {
    row: data,
    isFresh,
    ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000)),
  };
}
