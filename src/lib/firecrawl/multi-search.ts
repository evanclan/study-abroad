import Firecrawl from '@mendable/firecrawl-js';

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

export interface FirecrawlDoc {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

interface SearchOptions {
  query: string;
  limit?: number;
  withMarkdown?: boolean;
}

interface FirecrawlSearchHit {
  url?: string;
  markdown?: string;
  metadata?: { title?: string; sourceURL?: string; url?: string; description?: string };
  title?: string;
  description?: string;
}

interface FirecrawlSearchData {
  web?: FirecrawlSearchHit[];
}

/**
 * Thin, type-safe wrapper around Firecrawl /search. We deliberately keep
 * scraping optional because a metadata-only search is much cheaper and
 * sufficient when we only need URLs + titles (e.g. for reference lists).
 */
export async function firecrawlSearch({
  query,
  limit = 5,
  withMarkdown = false,
}: SearchOptions): Promise<FirecrawlDoc[]> {
  const firecrawl = getFirecrawl();

  const result = (await firecrawl.search(query, {
    sources: ['web'],
    limit,
    ...(withMarkdown
      ? {
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 20_000,
          },
        }
      : {}),
  })) as FirecrawlSearchData;

  const hits = result.web ?? [];

  const docs: FirecrawlDoc[] = [];
  for (const hit of hits) {
    const url = hit.metadata?.sourceURL ?? hit.metadata?.url ?? hit.url ?? '';
    if (!url) continue;
    docs.push({
      url,
      title: hit.metadata?.title ?? hit.title,
      description: hit.metadata?.description ?? hit.description,
      markdown: hit.markdown,
    });
  }
  return docs;
}
