import Firecrawl from '@mendable/firecrawl-js';
import { firecrawlSearch } from '@/lib/firecrawl/multi-search';
import { COUNTRY_LABELS_EN } from '@/lib/quote/labels';
import type { QuoteParams } from '@/types/quote';

let cached: Firecrawl | null = null;

function getFirecrawl(): Firecrawl {
  if (cached) return cached;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set. Add it to .env.local.');
  }
  cached = new Firecrawl({ apiKey });
  return cached;
}

export interface ScrapeResult {
  url: string;
  markdown: string;
  title?: string;
}

interface ScrapeInput {
  params: QuoteParams;
  knownUrl: string | null;
}

const QUERY_BY_COURSE: Record<string, string> = {
  summer_camp: 'summer camp programme tuition cost',
  highschool: 'high school exchange programme tuition fees',
  language_school: 'language school course fees tuition international students',
  university: 'international student tuition fees',
  vocational: 'vocational programme international tuition',
};

interface FirecrawlDocumentLike {
  url?: string;
  markdown?: string;
  metadata?: { title?: string; sourceURL?: string; url?: string };
  title?: string;
}

/**
 * Pull the canonical pricing page for a single school. Used when we already
 * know the school URL; otherwise the schools-research agent finds candidates.
 */
export async function scrapeSchool({ params, knownUrl }: ScrapeInput): Promise<ScrapeResult> {
  const firecrawl = getFirecrawl();

  if (knownUrl) {
    const document = (await firecrawl.scrape(knownUrl, {
      formats: ['markdown'],
      onlyMainContent: true,
    })) as FirecrawlDocumentLike;

    return {
      url: knownUrl,
      markdown: document.markdown ?? '',
      title: document.metadata?.title,
    };
  }

  const queryParts = [
    params.schoolName ?? '',
    params.cityOrRegion ?? '',
    COUNTRY_LABELS_EN[params.countryCode] ?? params.countryCode,
    QUERY_BY_COURSE[params.courseSlug] ?? '',
  ].filter(Boolean);
  const query = queryParts.join(' ').trim();

  const hits = await firecrawlSearch({ query, limit: 3, withMarkdown: true });
  const withMarkdown = hits.find((h) => h.markdown && h.markdown.length > 200);
  const fallback = hits[0];
  const hit = withMarkdown ?? fallback;

  if (!hit) {
    throw new Error(`Firecrawl returned no results for query: ${query}`);
  }

  return {
    url: hit.url,
    markdown: hit.markdown ?? '',
    title: hit.title,
  };
}
