import { extractCostsFromScrape } from '@/lib/ai/extract-costs';
import { streamQuoteInsights } from '@/lib/ai/generate-insights';
import { parseQuoteQuery } from '@/lib/ai/parse-query';
import { scrapeSchool } from '@/lib/firecrawl/scrape-school';
import { getJpyConversion } from '@/lib/fx/get-rate';
import { researchAccommodation } from '@/lib/research/search-accommodation';
import { researchActivities } from '@/lib/research/search-activities';
import { researchLocation } from '@/lib/research/search-location';
import { researchSchools } from '@/lib/research/search-schools';
import { computeBudgetFit } from '@/lib/quote/budget-fit';
import { lookupQuoteCache } from '@/lib/quote/cache-lookup';
import { estimateExtras } from '@/lib/quote/estimate-extras';
import {
  recordQuoteHistory,
  upsertQuoteCache,
} from '@/lib/quote/upsert-quote';
import { getServerSupabase } from '@/lib/supabase/local-client';
import { searchKnowledgeForQuote } from '@/lib/uploads/search-knowledge';
import type {
  AccommodationOption,
  ActivityItem,
  AiInsights,
  BudgetFit,
  KnowledgeLookup,
  KnowledgeMatch,
  LocationIntel,
  QuoteCosts,
  QuoteParams,
  QuoteResult,
  ReferenceSource,
  SchoolCard,
  StreamEvent,
} from '@/types/quote';

interface OrchestrateInput {
  prompt: string;
}

interface ResearchBundle {
  schools: SchoolCard[];
  accommodations: AccommodationOption[];
  activities: ActivityItem[];
  location: LocationIntel | null;
  references: ReferenceSource[];
}

/**
 * The orchestrator is an async generator that yields typed StreamEvents in the
 * order they happen. The SSE route handler simply pipes events into the wire.
 *
 * The pipeline is fan-out / fan-in:
 *  1. Parse the prompt (Claude tool-use).
 *  2. Cache lookup (Supabase).
 *  3. If miss: kick off 5 parallel jobs (scrape primary, research schools,
 *     accommodation, location, activities). Each yields its event as it
 *     resolves so the UI lights up sub-second.
 *  4. Synthesise costs + budget fit.
 *  5. Stream comprehensive AI insights.
 *  6. Self-heal cache.
 */
export async function* orchestrateQuote(
  input: OrchestrateInput,
): AsyncGenerator<StreamEvent, void, void> {
  const startedAt = Date.now();

  // ---- Phase 1: parse ----
  let params: QuoteParams;
  try {
    yield { type: 'phase', phase: 'parsing', message: 'プロンプトを解析中…' };
    params = await parseQuoteQuery(input.prompt);
    yield { type: 'params', params };
  } catch (err) {
    yield {
      type: 'error',
      phase: 'parsing',
      message: errorMessage(err, 'プロンプトを解析できませんでした。'),
    };
    return;
  }

  // ---- Phase 2a: local knowledge lookup (Upload Hub citations) ----
  yield {
    type: 'phase',
    phase: 'knowledge_lookup',
    message: 'アップロード済み資料を検索中…',
  };
  let knowledge: KnowledgeLookup | null = null;
  try {
    knowledge = await searchKnowledgeForQuote(params, input.prompt);
    if (knowledge) yield { type: 'knowledge', knowledge };
  } catch (err) {
    console.warn('[orchestrator] knowledge lookup failed', err);
  }

  const knowledgeRefs = matchesToReferences(knowledge?.matches ?? []);

  // ---- Phase 2b: cache lookup ----
  yield { type: 'phase', phase: 'cache_lookup' };
  const cacheHit = await lookupQuoteCache(params);

  if (cacheHit?.isFresh) {
    const costs = await composeCachedCosts(cacheHit.row, params);
    yield {
      type: 'source',
      source: 'local',
      sourceUrl: cacheHit.row.source_url,
      schoolName: cacheHit.row.school_name,
      cachedAt: cacheHit.row.updated_at,
    };
    yield { type: 'costs', costs };

    const cachedSummary = cacheHit.row.ai_summary_ja ?? '';
    const cachedSuggestions = readSuggestions(cacheHit.row.ai_suggestions_ja);
    if (cachedSummary) yield { type: 'insightDelta', text: cachedSummary };
    for (const s of cachedSuggestions) {
      yield { type: 'insightSuggestion', suggestion: s };
    }

    const budget = computeBudgetFit({ params, costs });
    if (budget) yield { type: 'budget', budget };

    if (knowledgeRefs.length > 0) {
      yield { type: 'references', references: knowledgeRefs };
    }

    const result: QuoteResult = {
      source: 'local',
      sourceUrl: cacheHit.row.source_url,
      params,
      costs,
      aiInsights: { summary: cachedSummary, suggestions: cachedSuggestions },
      schoolName: cacheHit.row.school_name,
      schools: [],
      accommodations: [],
      activities: [],
      location: null,
      budgetFit: budget,
      references: knowledgeRefs,
      knowledge,
      updatedAt: cacheHit.row.updated_at,
    };
    yield { type: 'done', result };
    void recordQuoteHistory({
      promptText: input.prompt,
      params,
      source: 'local',
      resultQuoteId: cacheHit.row.id,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  // If the local knowledge base is strong enough on its own, render LOCAL
  // without falling through to live web research at all. We still compute
  // FX + extras so the JPY total is meaningful.
  if (knowledge && knowledge.sufficient && knowledge.matches.length > 0) {
    yield {
      type: 'source',
      source: 'local',
      sourceUrl: null,
      schoolName:
        params.schoolName ?? knowledge.matches[0]?.schoolName ?? null,
    };

    const localCosts = await composeCostsFromKnowledge(knowledge.matches, params);
    yield { type: 'costs', costs: localCosts };

    const budget = computeBudgetFit({ params, costs: localCosts });
    if (budget) yield { type: 'budget', budget };

    yield { type: 'references', references: knowledgeRefs };

    yield {
      type: 'insightDelta',
      text: knowledge.rationaleJa + '\n\n',
    };

    const result: QuoteResult = {
      source: 'local',
      sourceUrl: null,
      params,
      costs: localCosts,
      aiInsights: {
        summary: knowledge.rationaleJa,
        suggestions: [],
      },
      schoolName:
        params.schoolName ?? knowledge.matches[0]?.schoolName ?? null,
      schools: [],
      accommodations: [],
      activities: [],
      location: null,
      budgetFit: budget,
      references: knowledgeRefs,
      knowledge,
      updatedAt: new Date().toISOString(),
    };
    yield { type: 'done', result };
    void recordQuoteHistory({
      promptText: input.prompt,
      params,
      source: 'local',
      resultQuoteId: null,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  // ---- Phase 3: live multi-agent research ----
  yield {
    type: 'source',
    source: 'live_search',
    sourceUrl: null,
    schoolName: params.schoolName ?? null,
  };

  yield { type: 'phase', phase: 'scraping', message: '対象ページを取得中…' };
  const knownUrl = await resolveKnownSchoolUrl(params);

  // Kick off ALL five jobs concurrently. We await them via a typed queue so we
  // can yield each result the moment it resolves rather than blocking on the
  // slowest one.
  const scrapePromise = scrapeSchool({ params, knownUrl })
    .then((r) => ({ kind: 'scrape' as const, value: r }))
    .catch((err) => ({ kind: 'scrape_err' as const, error: err }));
  const schoolsPromise = researchSchools({ params })
    .then((r) => ({ kind: 'schools' as const, value: r }))
    .catch((err) => ({ kind: 'schools_err' as const, error: err }));
  const accomPromise = researchAccommodation({ params })
    .then((r) => ({ kind: 'accom' as const, value: r }))
    .catch((err) => ({ kind: 'accom_err' as const, error: err }));
  const locationPromise = researchLocation({ params })
    .then((r) => ({ kind: 'location' as const, value: r }))
    .catch((err) => ({ kind: 'location_err' as const, error: err }));
  const activitiesPromise = researchActivities({ params })
    .then((r) => ({ kind: 'activities' as const, value: r }))
    .catch((err) => ({ kind: 'activities_err' as const, error: err }));

  const all: Promise<
    | { kind: 'scrape'; value: Awaited<ReturnType<typeof scrapeSchool>> }
    | { kind: 'scrape_err'; error: unknown }
    | { kind: 'schools'; value: Awaited<ReturnType<typeof researchSchools>> }
    | { kind: 'schools_err'; error: unknown }
    | { kind: 'accom'; value: Awaited<ReturnType<typeof researchAccommodation>> }
    | { kind: 'accom_err'; error: unknown }
    | { kind: 'location'; value: Awaited<ReturnType<typeof researchLocation>> }
    | { kind: 'location_err'; error: unknown }
    | { kind: 'activities'; value: Awaited<ReturnType<typeof researchActivities>> }
    | { kind: 'activities_err'; error: unknown }
  >[] = [
    scrapePromise,
    schoolsPromise,
    accomPromise,
    locationPromise,
    activitiesPromise,
  ];

  const bundle: ResearchBundle = {
    schools: [],
    accommodations: [],
    activities: [],
    location: null,
    references: [],
  };
  let primaryScrape: Awaited<ReturnType<typeof scrapeSchool>> | null = null;

  // Race the promises and yield as each settles. We rely on the fact that
  // every wrapper resolves (never rejects) so we never lose a slot.
  for (const settledEvent of await raceSettled(all)) {
    switch (settledEvent.kind) {
      case 'scrape':
        primaryScrape = settledEvent.value;
        yield {
          type: 'source',
          source: 'live_search',
          sourceUrl: settledEvent.value.url,
          schoolName: settledEvent.value.title ?? params.schoolName ?? null,
        };
        addRef(bundle.references, settledEvent.value.url, settledEvent.value.title, 'school');
        break;
      case 'schools':
        bundle.schools = settledEvent.value.schools;
        for (const src of settledEvent.value.sources) {
          addRef(bundle.references, src.url, src.title, 'school');
        }
        for (const s of bundle.schools) addRef(bundle.references, s.url, s.name, 'school');
        yield { type: 'schools', schools: bundle.schools };
        break;
      case 'accom':
        bundle.accommodations = settledEvent.value.options;
        for (const src of settledEvent.value.sources) {
          addRef(bundle.references, src.url, src.title, 'accommodation');
        }
        for (const a of bundle.accommodations) {
          if (a.url) addRef(bundle.references, a.url, a.name, 'accommodation');
        }
        yield { type: 'accommodations', accommodations: bundle.accommodations };
        break;
      case 'location':
        if (settledEvent.value.intel) {
          bundle.location = settledEvent.value.intel;
          yield { type: 'location', location: bundle.location };
        }
        for (const src of settledEvent.value.sources) {
          addRef(bundle.references, src.url, src.title, 'location');
        }
        break;
      case 'activities':
        bundle.activities = settledEvent.value.activities;
        for (const src of settledEvent.value.sources) {
          addRef(bundle.references, src.url, src.title, 'activity');
        }
        for (const a of bundle.activities) {
          if (a.url) addRef(bundle.references, a.url, a.title, 'activity');
        }
        yield { type: 'activities', activities: bundle.activities };
        break;
      case 'scrape_err':
        // Non-fatal: we can still build a useful quote from research alone.
        yield {
          type: 'error',
          phase: 'scraping',
          message: errorMessage(settledEvent.error, '主候補校のスクレイピングに失敗しました。'),
        };
        break;
      case 'schools_err':
      case 'accom_err':
      case 'location_err':
      case 'activities_err':
        // Silent degrade — log only; the section just stays empty.
        console.warn('[orchestrator] research failure', settledEvent);
        break;
    }
  }

  // Merge knowledge-hub refs in front so counselors see the local source citations first.
  for (const r of knowledgeRefs) {
    if (!bundle.references.some((existing) => existing.url === r.url)) {
      bundle.references.unshift(r);
    }
  }
  yield { type: 'references', references: bundle.references };

  // ---- Phase 4: cost extraction + FX + extras ----
  let extracted: Awaited<ReturnType<typeof extractCostsFromScrape>> | null = null;
  if (primaryScrape) {
    try {
      yield { type: 'phase', phase: 'extracting', message: '料金を抽出中…' };
      extracted = await extractCostsFromScrape({
        params,
        markdown: primaryScrape.markdown,
        url: primaryScrape.url,
      });
    } catch (err) {
      yield {
        type: 'error',
        phase: 'extracting',
        message: errorMessage(err, '料金の抽出に失敗しました。'),
      };
    }
  }

  yield { type: 'phase', phase: 'fx' };
  const currency = extracted?.currencyCode ?? defaultCurrencyFor(params.countryCode);
  const fx = await getJpyConversion(currency);

  const tuition =
    extracted?.tuition && extracted.tuition > 0
      ? extracted.tuition
      : await estimateTuitionFromSchools(bundle.schools, currency, params);
  const accommodation =
    extracted?.accommodation && extracted.accommodation > 0
      ? extracted.accommodation
      : await estimateAccomFromOptions(bundle.accommodations, currency, params);
  const registration = extracted?.registration ?? 0;
  const otherFees = extracted?.otherFees ?? 0;
  const localTotal = tuition + accommodation + registration + otherFees;
  const extras = estimateExtras(params);
  const extrasJpy = extras.flights + extras.insurance + extras.visa + extras.livingExpenses;
  const totalJpy = localTotal * fx.rate + extrasJpy;

  const costs: QuoteCosts = {
    currencyCode: currency,
    tuition,
    accommodation,
    registration,
    otherFees,
    flights: extras.flights,
    insurance: extras.insurance,
    visa: extras.visa,
    livingExpenses: extras.livingExpenses,
    total: localTotal,
    totalJpy,
    fxRate: fx.rate,
    fxFetchedAt: fx.fetchedAt,
  };
  yield { type: 'costs', costs };

  // ---- Phase 5: budget ----
  yield { type: 'phase', phase: 'budget' };
  const budget = computeBudgetFit({ params, costs });
  if (budget) yield { type: 'budget', budget };

  // ---- Phase 6: insights ----
  yield { type: 'phase', phase: 'insights' };
  const schoolName =
    extracted?.schoolName ?? primaryScrape?.title ?? params.schoolName ?? bundle.schools[0]?.name ?? null;

  const insightStream = streamQuoteInsights({
    params,
    costs,
    schoolName,
    sourceUrl: primaryScrape?.url ?? null,
    schools: bundle.schools,
    accommodations: bundle.accommodations,
    activities: bundle.activities,
    location: bundle.location,
    budgetFit: budget,
  });

  let insightSummary = '';
  const insightSuggestions: string[] = [];
  try {
    while (true) {
      const next = await insightStream.next();
      if (next.done) {
        const final = next.value;
        if (final?.summary) insightSummary = final.summary;
        if (final?.suggestions?.length) {
          insightSuggestions.length = 0;
          insightSuggestions.push(...final.suggestions);
        }
        break;
      }
      if (next.value.summaryDelta) {
        insightSummary += next.value.summaryDelta;
        yield { type: 'insightDelta', text: next.value.summaryDelta };
      }
      if (next.value.suggestion) {
        insightSuggestions.push(next.value.suggestion);
        yield { type: 'insightSuggestion', suggestion: next.value.suggestion };
      }
    }
  } catch (err) {
    yield {
      type: 'error',
      phase: 'insights',
      message: errorMessage(err, 'AIアドバイスの生成に失敗しました。'),
    };
  }

  const insights: AiInsights = {
    summary: insightSummary.trim(),
    suggestions: insightSuggestions,
  };

  // ---- Phase 7: persist ----
  yield { type: 'phase', phase: 'persisting' };
  const persisted = await upsertQuoteCache({
    params,
    costs,
    schoolName,
    sourceUrl: primaryScrape?.url ?? null,
    aiSummary: insights.summary,
    aiSuggestions: insights.suggestions,
    rawExtraction: {
      title: primaryScrape?.title ?? null,
      markdown_excerpt: primaryScrape?.markdown.slice(0, 500) ?? null,
      confidence: extracted?.confidence ?? null,
      schools_found: bundle.schools.length,
      accommodations_found: bundle.accommodations.length,
      activities_found: bundle.activities.length,
    },
  });

  const result: QuoteResult = {
    source: 'live_search',
    sourceUrl: primaryScrape?.url ?? bundle.schools[0]?.url ?? null,
    params,
    costs,
    aiInsights: insights,
    schoolName,
    schools: bundle.schools,
    accommodations: bundle.accommodations,
    activities: bundle.activities,
    location: bundle.location,
    budgetFit: budget,
    references: bundle.references,
    knowledge,
    updatedAt: persisted?.updated_at ?? new Date().toISOString(),
  };

  yield { type: 'done', result };

  void recordQuoteHistory({
    promptText: input.prompt,
    params,
    source: 'live_search',
    resultQuoteId: persisted?.id ?? null,
    durationMs: Date.now() - startedAt,
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolves an array of promises in completion order. Each input must already
 * be wrapped so it never rejects (the orchestrator wraps with .catch above).
 */
async function raceSettled<T>(promises: Promise<T>[]): Promise<T[]> {
  // Simple sequential await of `Promise.all`-style settling produces a
  // completion-ordered iterator via an internal queue.
  return new Promise<T[]>((resolve) => {
    const out: T[] = [];
    let remaining = promises.length;
    if (remaining === 0) resolve(out);
    for (const p of promises) {
      void p.then((value) => {
        out.push(value);
        remaining -= 1;
        if (remaining === 0) resolve(out);
      });
    }
  });
}

function addRef(
  list: ReferenceSource[],
  url: string,
  title: string | undefined,
  category: ReferenceSource['category'],
) {
  if (!url) return;
  if (list.some((r) => r.url === url)) return;
  list.push({ url, title, category });
}

function defaultCurrencyFor(code: QuoteParams['countryCode']): string {
  const map: Record<QuoteParams['countryCode'], string> = {
    AU: 'AUD',
    US: 'USD',
    GB: 'GBP',
    CA: 'CAD',
    NZ: 'NZD',
    IE: 'EUR',
    MT: 'EUR',
    PH: 'PHP',
    JP: 'JPY',
  };
  return map[code];
}

// Convert any currency to the target via fetched FX rates. Same currency or
// missing currencyCode (assumed target) needs no conversion.
async function convertToTarget(
  amount: number,
  fromCurrency: string | undefined,
  targetCurrency: string,
): Promise<number> {
  const from = (fromCurrency ?? targetCurrency).toUpperCase();
  if (from === targetCurrency) return amount;
  // Convert via JPY: amount * (from→JPY) / (target→JPY)
  const fromToJpy = await getJpyConversion(from);
  const targetToJpy = await getJpyConversion(targetCurrency);
  return (amount * fromToJpy.rate) / Math.max(0.01, targetToJpy.rate);
}

async function estimateTuitionFromSchools(
  schools: SchoolCard[],
  currency: string,
  params: QuoteParams,
): Promise<number> {
  // Schools may publish prices in many currencies — convert each to target.
  const weeklyConverted: number[] = [];
  for (const s of schools) {
    if (!s.weeklyTuition) continue;
    const converted = await convertToTarget(s.weeklyTuition, s.currencyCode, currency);
    weeklyConverted.push(converted);
  }
  if (weeklyConverted.length > 0) {
    const avg = weeklyConverted.reduce((a, b) => a + b, 0) / weeklyConverted.length;
    return Math.round(avg * params.durationWeeks);
  }

  const totals: number[] = [];
  for (const s of schools) {
    if (!s.totalEstimate) continue;
    totals.push(await convertToTarget(s.totalEstimate, s.currencyCode, currency));
  }
  if (totals.length > 0) {
    return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  }
  return 0;
}

async function estimateAccomFromOptions(
  options: AccommodationOption[],
  currency: string,
  params: QuoteParams,
): Promise<number> {
  const totals: number[] = [];
  for (const o of options) {
    let local: number | null = null;
    if (o.pricePerWeek) local = o.pricePerWeek * params.durationWeeks;
    else if (o.pricePerNight) local = o.pricePerNight * params.durationWeeks * 7;
    else if (o.pricePerMonth) local = o.pricePerMonth * params.durationMonths;
    if (local == null) continue;
    totals.push(await convertToTarget(local, o.currencyCode, currency));
  }
  if (totals.length === 0) return 0;
  totals.sort((a, b) => a - b);
  return Math.round(totals[Math.floor(totals.length / 2)]);
}

function matchesToReferences(matches: KnowledgeMatch[]): ReferenceSource[] {
  const out: ReferenceSource[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const url = m.source.signedUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      title:
        m.source.title ??
        m.source.filename ??
        m.title,
      category: 'document',
    });
  }
  return out;
}

/**
 * Build a QuoteCosts approximation purely from local knowledge-base entities.
 * We average prices in the matched currency and apply FX + extras.
 */
async function composeCostsFromKnowledge(
  matches: KnowledgeMatch[],
  params: QuoteParams,
): Promise<QuoteCosts> {
  const currency =
    matches.find((m) => m.currencyCode)?.currencyCode ??
    defaultCurrencyFor(params.countryCode);

  const fx = await getJpyConversion(currency);
  const tuition = await averageEntityCost(matches, ['price', 'program'], currency, params);
  const accommodation = await averageEntityCost(matches, ['accommodation'], currency, params);
  const registration = await averageOneTime(matches, ['rule', 'price'], currency, /enroll|register|registration|入学/i);

  const localTotal = tuition + accommodation + registration;
  const extras = estimateExtras(params);
  const extrasJpy = extras.flights + extras.insurance + extras.visa + extras.livingExpenses;

  return {
    currencyCode: currency,
    tuition,
    accommodation,
    registration,
    otherFees: 0,
    flights: extras.flights,
    insurance: extras.insurance,
    visa: extras.visa,
    livingExpenses: extras.livingExpenses,
    total: localTotal,
    totalJpy: localTotal * fx.rate + extrasJpy,
    fxRate: fx.rate,
    fxFetchedAt: fx.fetchedAt,
  };
}

async function averageEntityCost(
  matches: KnowledgeMatch[],
  types: KnowledgeMatch['entityType'][],
  targetCurrency: string,
  params: QuoteParams,
): Promise<number> {
  const candidates = matches.filter(
    (m) => m.amount != null && types.includes(m.entityType),
  );
  if (candidates.length === 0) return 0;
  const totals: number[] = [];
  for (const c of candidates) {
    if (c.amount == null) continue;
    let total = c.amount;
    switch (c.amountUnit) {
      case 'per_week':
        total = c.amount * params.durationWeeks;
        break;
      case 'per_month':
        total = c.amount * params.durationMonths;
        break;
      case 'per_night':
        total = c.amount * params.durationWeeks * 7;
        break;
      case 'per_year':
        total = (c.amount * params.durationMonths) / 12;
        break;
      case 'total':
      case 'one_time':
      default:
        total = c.amount;
        break;
    }
    totals.push(await convertToTarget(total, c.currencyCode ?? undefined, targetCurrency));
  }
  if (totals.length === 0) return 0;
  totals.sort((a, b) => a - b);
  return Math.round(totals[Math.floor(totals.length / 2)]);
}

async function averageOneTime(
  matches: KnowledgeMatch[],
  types: KnowledgeMatch['entityType'][],
  targetCurrency: string,
  titlePattern: RegExp,
): Promise<number> {
  const candidates = matches.filter(
    (m) =>
      m.amount != null &&
      types.includes(m.entityType) &&
      titlePattern.test(m.title),
  );
  if (candidates.length === 0) return 0;
  const totals: number[] = [];
  for (const c of candidates) {
    if (c.amount == null) continue;
    totals.push(
      await convertToTarget(c.amount, c.currencyCode ?? undefined, targetCurrency),
    );
  }
  if (totals.length === 0) return 0;
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

async function composeCachedCosts(
  row: NonNullable<Awaited<ReturnType<typeof lookupQuoteCache>>>['row'],
  params: QuoteParams,
): Promise<QuoteCosts> {
  const fx = await getJpyConversion(row.currency_code);
  const tuition = Number(row.tuition);
  const accommodation = Number(row.accommodation);
  const registration = Number(row.registration);
  const otherFees = Number(row.other_fees);
  const localTotal = tuition + accommodation + registration + otherFees;
  const extras = estimateExtras(params);
  const extrasJpy = extras.flights + extras.insurance + extras.visa + extras.livingExpenses;
  return {
    currencyCode: row.currency_code,
    tuition,
    accommodation,
    registration,
    otherFees,
    flights: extras.flights,
    insurance: extras.insurance,
    visa: extras.visa,
    livingExpenses: extras.livingExpenses,
    total: localTotal,
    totalJpy: localTotal * fx.rate + extrasJpy,
    fxRate: fx.rate,
    fxFetchedAt: fx.fetchedAt,
  };
}

async function resolveKnownSchoolUrl(params: QuoteParams): Promise<string | null> {
  if (!params.schoolName) return null;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('schools')
      .select('source_url')
      .eq('country_code', params.countryCode)
      .ilike('name', `%${params.schoolName}%`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.source_url ?? null;
  } catch {
    return null;
  }
}

function readSuggestions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err;
  return fallback;
}
