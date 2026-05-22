import { getServerSupabase } from '@/lib/supabase/local-client';
import type { RecentQuote, SupportedCountryCode, CourseSlug } from '@/types/quote';

export const runtime = 'nodejs';

// Lightweight feed for the right-side rail. Keeps the LLM call out of the hot
// path so the rail stays snappy across page loads.
export async function GET() {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('quote_history')
    .select('id, prompt_text, source, parsed_params, created_at, result_quote_id')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const recent: RecentQuote[] = (data ?? []).map((row) => {
    const params = (row.parsed_params as Record<string, unknown> | null) ?? {};
    return {
      id: row.id,
      promptText: row.prompt_text,
      source: row.source,
      countryCode: (params.countryCode as SupportedCountryCode) ?? 'AU',
      courseSlug: (params.courseSlug as CourseSlug) ?? 'language_school',
      totalJpy: null,
      createdAt: row.created_at,
    };
  });

  return Response.json({ items: recent });
}
