// Single source of truth for the cross-tier contracts used by the quote engine.
// Server-side orchestrator, the SSE route, the React hook, and the UI columns
// all import from here so refactors are mechanical.

export const COURSE_SLUGS = [
  'summer_camp',
  'highschool',
  'language_school',
  'university',
  'vocational',
] as const;

export type CourseSlug = (typeof COURSE_SLUGS)[number];

export const AGE_BRACKETS = ['0-12', '13-15', '16-18', '19-25', '26+'] as const;

export type AgeBracket = (typeof AGE_BRACKETS)[number];

export type SupportedCountryCode =
  | 'AU'
  | 'US'
  | 'GB'
  | 'CA'
  | 'NZ'
  | 'IE'
  | 'MT'
  | 'PH'
  | 'JP';

export interface QuoteParams {
  countryCode: SupportedCountryCode;
  courseSlug: CourseSlug;
  age: number;
  ageBracket: AgeBracket;
  durationMonths: number;
  durationWeeks: number;
  schoolName?: string;
  /** Free-form city / region target ("Cebu", "Okinawa", "Brisbane"). */
  cityOrRegion?: string;
  /** Lifestyle / accommodation preferences extracted from the prompt. */
  preferences: string[];
  /** Budget in JPY if the counselor mentioned one. */
  budgetJpy?: number;
  /** Source language for AI advice. */
  language: 'ja' | 'en';
}

export interface QuoteCosts {
  currencyCode: string;
  tuition: number;
  accommodation: number;
  registration: number;
  otherFees: number;
  /** Additional rolled-up costs not on the source page. */
  flights: number;
  insurance: number;
  visa: number;
  livingExpenses: number;
  total: number;
  totalJpy: number;
  fxRate: number;
  fxFetchedAt: string;
}

export interface AiInsights {
  summary: string;
  suggestions: string[];
  /** Markdown sections for the "everything you need to know" panel. */
  briefing?: string;
}

export type QuoteSource = 'local' | 'live_search';

// =============================================================================
// Multi-agent research payloads
// =============================================================================

export interface SchoolCard {
  name: string;
  url: string;
  description?: string;
  weeklyTuition?: number;
  totalEstimate?: number;
  currencyCode?: string;
  highlights: string[];
  distanceToBeachKm?: number;
  /** Free-form neighborhood / city ("Naha", "Kamakura", "Sentosa"). */
  location?: string;
  programs: string[];
  ageRange?: string;
}

export type AccommodationKind =
  | 'apartment'
  | 'share_house'
  | 'dorm'
  | 'homestay'
  | 'hotel'
  | 'guesthouse'
  | 'other';

export interface AccommodationOption {
  kind: AccommodationKind;
  name: string;
  url?: string;
  pricePerNight?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  currencyCode?: string;
  location?: string;
  distanceToBeachKm?: number;
  distanceToSchoolKm?: number;
  highlights: string[];
  rating?: number;
  imageUrl?: string;
}

export interface ActivityItem {
  title: string;
  url?: string;
  category: 'event' | 'beach' | 'food' | 'culture' | 'nightlife' | 'nature' | 'shopping' | 'other';
  description?: string;
  whenLabel?: string;
  priceJpy?: number;
}

export interface LocationIntel {
  city: string;
  country: string;
  vibe?: string;
  bestSeasonNote?: string;
  climateNote?: string;
  transitNote?: string;
  beachAccess?: string;
  safetyNote?: string;
  averageDailyBudgetJpy?: number;
  language?: string;
  timezone?: string;
}

export interface BudgetFit {
  budgetJpy: number;
  estimatedTotalJpy: number;
  deltaJpy: number;
  fits: boolean;
  /** Brief one-sentence verdict in the user's locale. */
  verdict: string;
  /** Concrete moves to bring the budget in line. */
  recommendations: string[];
}

export interface ReferenceSource {
  url: string;
  title?: string;
  category: 'school' | 'accommodation' | 'location' | 'activity' | 'cost' | 'other' | 'document';
}

// =============================================================================
// Local knowledge matches (Upload Hub citations)
// =============================================================================

export type KnowledgeEntityType =
  | 'school'
  | 'price'
  | 'campaign'
  | 'accommodation'
  | 'activity'
  | 'location'
  | 'rule'
  | 'contact'
  | 'program'
  | 'visa'
  | 'insurance'
  | 'flight'
  | 'note'
  | 'other';

export interface KnowledgeMatchSource {
  documentId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  title: string | null;
  sourceLabel: string | null;
  tags: string[];
  signedUrl: string | null;
}

export interface KnowledgeMatch {
  entityId: string;
  entityType: KnowledgeEntityType;
  title: string;
  summary: string | null;
  body: string | null;
  countryCode: string | null;
  courseSlug: string | null;
  schoolName: string | null;
  cityOrRegion: string | null;
  currencyCode: string | null;
  amount: number | null;
  amountUnit: string | null;
  validFrom: string | null;
  validTo: string | null;
  aiConfidence: number | null;
  score: number;
  source: KnowledgeMatchSource;
}

export interface KnowledgeLookup {
  matches: KnowledgeMatch[];
  totalMatches: number;
  sufficient: boolean;
  rationaleJa: string;
}

export interface QuoteResult {
  source: QuoteSource;
  sourceUrl: string | null;
  params: QuoteParams;
  costs: QuoteCosts;
  aiInsights: AiInsights;
  schoolName: string | null;
  schools: SchoolCard[];
  accommodations: AccommodationOption[];
  activities: ActivityItem[];
  location: LocationIntel | null;
  budgetFit: BudgetFit | null;
  references: ReferenceSource[];
  knowledge: KnowledgeLookup | null;
  updatedAt: string;
}

// =============================================================================
// SSE stream events. The orchestrator emits these in order; the client hook
// folds them into a typed state machine.
// =============================================================================

export type StreamEvent =
  | { type: 'params'; params: QuoteParams }
  | { type: 'phase'; phase: StreamPhase; message?: string }
  | {
      type: 'source';
      source: QuoteSource;
      sourceUrl: string | null;
      schoolName: string | null;
      cachedAt?: string;
    }
  | { type: 'costs'; costs: QuoteCosts }
  | { type: 'schools'; schools: SchoolCard[] }
  | { type: 'accommodations'; accommodations: AccommodationOption[] }
  | { type: 'activities'; activities: ActivityItem[] }
  | { type: 'location'; location: LocationIntel }
  | { type: 'budget'; budget: BudgetFit }
  | { type: 'references'; references: ReferenceSource[] }
  | { type: 'knowledge'; knowledge: KnowledgeLookup }
  | { type: 'insightDelta'; text: string }
  | { type: 'insightSuggestion'; suggestion: string }
  | { type: 'done'; result: QuoteResult }
  | { type: 'error'; message: string; phase: StreamPhase };

export type StreamPhase =
  | 'parsing'
  | 'cache_lookup'
  | 'knowledge_lookup'
  | 'scraping'
  | 'research_schools'
  | 'research_accommodation'
  | 'research_location'
  | 'research_activities'
  | 'extracting'
  | 'fx'
  | 'budget'
  | 'insights'
  | 'persisting'
  | 'done';

// =============================================================================
// Recent-quotes rail
// =============================================================================

export interface RecentQuote {
  id: string;
  promptText: string;
  source: QuoteSource;
  countryCode: SupportedCountryCode;
  courseSlug: CourseSlug;
  totalJpy: number | null;
  createdAt: string;
}
