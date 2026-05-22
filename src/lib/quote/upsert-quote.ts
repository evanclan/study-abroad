import { getServerSupabase } from '@/lib/supabase/local-client';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { QuoteCosts, QuoteParams } from '@/types/quote';

type QuoteCacheRow = Database['public']['Tables']['quote_cache']['Row'];

interface UpsertInput {
  params: QuoteParams;
  costs: QuoteCosts;
  schoolName: string | null;
  sourceUrl: string | null;
  aiSummary?: string | null;
  aiSuggestions?: string[] | null;
  rawExtraction?: Json | null;
}

/**
 * Self-healing write: every successful live_search rolls back into the cache so
 * the next identical query hits LOCAL and pays no token / scrape cost.
 */
export async function upsertQuoteCache(input: UpsertInput): Promise<QuoteCacheRow | null> {
  const supabase = getServerSupabase();

  // Resolve the school row (best-effort) so we can attach a stable FK.
  let schoolId: string | null = null;
  if (input.schoolName) {
    const { data: schoolRow } = await supabase
      .from('schools')
      .upsert(
        {
          country_code: input.params.countryCode,
          name: input.schoolName,
          source_url: input.sourceUrl,
        },
        { onConflict: 'country_code,name', ignoreDuplicates: false },
      )
      .select('id')
      .maybeSingle();
    schoolId = schoolRow?.id ?? null;
  }

  const { data, error } = await supabase
    .from('quote_cache')
    .upsert(
      {
        country_code: input.params.countryCode,
        course_slug: input.params.courseSlug,
        age_bracket: input.params.ageBracket,
        duration_months: input.params.durationMonths,
        school_id: schoolId,
        school_name: input.schoolName,
        source_url: input.sourceUrl,
        currency_code: input.costs.currencyCode,
        tuition: input.costs.tuition,
        accommodation: input.costs.accommodation,
        registration: input.costs.registration,
        other_fees: input.costs.otherFees,
        ai_summary_ja: input.aiSummary ?? null,
        ai_suggestions_ja: (input.aiSuggestions ?? null) as Json | null,
        raw_extraction: input.rawExtraction ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'country_code,course_slug,age_bracket,duration_months,school_id',
      },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[cache] upsert error', error);
    return null;
  }
  return data;
}

interface HistoryInput {
  promptText: string;
  params: QuoteParams;
  source: 'local' | 'live_search';
  resultQuoteId: string | null;
  durationMs: number;
}

export async function recordQuoteHistory(input: HistoryInput): Promise<void> {
  const supabase = getServerSupabase();
  await supabase.from('quote_history').insert({
    prompt_text: input.promptText,
    parsed_params: input.params as unknown as Json,
    result_quote_id: input.resultQuoteId,
    source: input.source,
    duration_ms: input.durationMs,
  });
}
