import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { firecrawlSearch } from '@/lib/firecrawl/multi-search';
import { COUNTRY_LABELS_EN } from '@/lib/quote/labels';
import type {
  AccommodationKind,
  AccommodationOption,
  QuoteParams,
} from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_accommodation_candidates';

const ACCOMMODATION_KINDS = [
  'apartment',
  'share_house',
  'dorm',
  'homestay',
  'hotel',
  'guesthouse',
  'other',
] as const satisfies readonly AccommodationKind[];

const OptionSchema = z
  .object({
    kind: z.enum(ACCOMMODATION_KINDS).catch('other' as const),
    name: z.string(),
    url: z.string().url().optional().catch(undefined),
    pricePerNight: z.number().nonnegative().optional().catch(undefined),
    pricePerWeek: z.number().nonnegative().optional().catch(undefined),
    pricePerMonth: z.number().nonnegative().optional().catch(undefined),
    currencyCode: z.string().length(3).optional().catch(undefined),
    location: z.string().optional().catch(undefined),
    distanceToBeachKm: z.number().nonnegative().optional().catch(undefined),
    distanceToSchoolKm: z.number().nonnegative().optional().catch(undefined),
    highlights: z.array(z.string()).max(6).default([]).catch([]),
    // LLMs sometimes return ratings out of 10 — clamp to 5.
    rating: z
      .number()
      .optional()
      .transform((v) => (v == null ? undefined : Math.max(0, Math.min(5, v > 5 ? v / 2 : v))))
      .catch(undefined),
    imageUrl: z.string().url().optional().catch(undefined),
  })
  .passthrough();

const PayloadSchema = z.object({
  options: z.array(OptionSchema).max(10).default([]),
});

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit 3-6 accommodation options (apartments, share houses, dorms, homestays, hotels) drawn from the provided search results.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: [...ACCOMMODATION_KINDS] },
            name: { type: 'string' },
            url: { type: 'string' },
            pricePerNight: { type: 'number' },
            pricePerWeek: { type: 'number' },
            pricePerMonth: { type: 'number' },
            currencyCode: { type: 'string' },
            location: { type: 'string' },
            distanceToBeachKm: { type: 'number' },
            distanceToSchoolKm: { type: 'number' },
            highlights: { type: 'array', items: { type: 'string' } },
            rating: { type: 'number' },
            imageUrl: { type: 'string' },
          },
          required: ['kind', 'name'],
        },
      },
    },
    required: ['options'],
  },
};

const SYSTEM_PROMPT = `あなたは留学生向け宿泊リサーチエージェントです。検索結果から、学生の予算と
ライフスタイル希望に合う宿泊先（アパート、シェアハウス、ドーミトリー、ホームステイ、
ホテル、ゲストハウス等）を3〜6件選んで返してください。
- ビーチに近いこと、学校から徒歩圏内であること、予算内に収まること等を優先します。
- URLは検索結果に実在するものだけを使用すること。架空のURLは作らないこと。
- 価格は判明している単位（per night/per week/per month）でそれぞれ別フィールドに入れる。
- imageUrl は metadata/og:image 等から取れるものだけ入れる。なければ省略。`;

interface ResearchInput {
  params: QuoteParams;
}

interface ResearchOutput {
  options: AccommodationOption[];
  sources: { url: string; title?: string }[];
}

function buildQuery(params: QuoteParams): string {
  const wantsBeach = params.preferences.some((p) => /beach|ocean|coast|海/i.test(p));
  const wantsApartment = params.preferences.some((p) =>
    /apartment|aparthotel|アパート|マンション/i.test(p),
  );
  const wantsShareHouse = params.preferences.some((p) =>
    /share|shared|シェア/i.test(p),
  );
  const segments: string[] = [];
  if (wantsApartment) segments.push('apartment short stay');
  else if (wantsShareHouse) segments.push('share house');
  else segments.push('short stay accommodation');
  if (wantsBeach) segments.push('near beach');
  segments.push(params.cityOrRegion ?? '');
  segments.push(COUNTRY_LABELS_EN[params.countryCode]);
  segments.push(`${params.durationWeeks} weeks`);
  segments.push('international students');
  return segments.filter(Boolean).join(' ');
}

export async function researchAccommodation({
  params,
}: ResearchInput): Promise<ResearchOutput> {
  const query = buildQuery(params);
  const hits = await firecrawlSearch({ query, limit: 6, withMarkdown: true });
  if (hits.length === 0) return { options: [], sources: [] };

  const anthropic = getAnthropic();
  const payload = [
    `Student profile:`,
    `  Country: ${COUNTRY_LABELS_EN[params.countryCode]}`,
    `  City: ${params.cityOrRegion ?? 'flexible'}`,
    `  Duration: ${params.durationWeeks} weeks`,
    `  Preferences: ${params.preferences.join(', ') || 'none'}`,
    `  Budget (JPY total): ${params.budgetJpy ?? 'unspecified'}`,
    '',
    `Search results to choose from:`,
    ...hits.map((h, i) =>
      [
        `[${i + 1}] ${h.title ?? 'Untitled'}`,
        `URL: ${h.url}`,
        h.description ? `Desc: ${h.description}` : '',
        h.markdown ? `Body excerpt: ${h.markdown.slice(0, 2000)}` : '',
        '---',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1800,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: payload }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === TOOL_NAME,
  );
  if (!toolUse) return { options: [], sources: [] };

  const parsed = PayloadSchema.parse(toolUse.input);
  const validUrls = new Set(hits.map((h) => h.url));
  const safeOptions: AccommodationOption[] = parsed.options.map((o) => ({
    ...o,
    // Drop URLs that the LLM fabricated (i.e. not in our search results).
    url: o.url && validUrls.has(o.url) ? o.url : undefined,
  }));

  return {
    options: safeOptions,
    sources: hits.map((h) => ({ url: h.url, title: h.title })),
  };
}
