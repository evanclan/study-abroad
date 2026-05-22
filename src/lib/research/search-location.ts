import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { firecrawlSearch } from '@/lib/firecrawl/multi-search';
import { COUNTRY_LABELS_EN } from '@/lib/quote/labels';
import type { LocationIntel, QuoteParams } from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_location_intel';

const PayloadSchema = z.object({
  city: z.string(),
  country: z.string(),
  vibe: z.string().optional(),
  bestSeasonNote: z.string().optional(),
  climateNote: z.string().optional(),
  transitNote: z.string().optional(),
  beachAccess: z.string().optional(),
  safetyNote: z.string().optional(),
  averageDailyBudgetJpy: z.coerce.number().nonnegative().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit a structured neighborhood/city briefing for a counselor advising a study-abroad student.',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      country: { type: 'string' },
      vibe: { type: 'string', description: '一文の街の雰囲気（例: 「のどかなリゾートタウン」）' },
      bestSeasonNote: { type: 'string' },
      climateNote: { type: 'string' },
      transitNote: { type: 'string' },
      beachAccess: { type: 'string', description: '近隣のビーチと所要時間（あれば）' },
      safetyNote: { type: 'string' },
      averageDailyBudgetJpy: { type: 'number', description: '1日あたりの生活費目安（円）' },
      language: { type: 'string' },
      timezone: { type: 'string' },
    },
    required: ['city', 'country'],
  },
};

const SYSTEM_PROMPT = `あなたは留学先のロケーション・インテリジェンスを提供する
リサーチエージェントです。検索結果と一般知識を組み合わせ、街の雰囲気・気候・
交通・ビーチアクセス・治安・生活費・言語・タイムゾーンを簡潔にまとめてください。
全フィールド日本語で記述。不明なフィールドは省略可。`;

interface ResearchInput {
  params: QuoteParams;
}

interface ResearchOutput {
  intel: LocationIntel | null;
  sources: { url: string; title?: string }[];
}

function buildQuery(params: QuoteParams): string {
  const segments: string[] = [];
  segments.push(params.cityOrRegion ?? '');
  segments.push(COUNTRY_LABELS_EN[params.countryCode]);
  segments.push('travel guide neighborhood overview');
  if (params.preferences.some((p) => /beach|ocean|海/i.test(p))) segments.push('beach access');
  return segments.filter(Boolean).join(' ');
}

export async function researchLocation({
  params,
}: ResearchInput): Promise<ResearchOutput> {
  const query = buildQuery(params);
  const hits = await firecrawlSearch({ query, limit: 4, withMarkdown: true });

  const anthropic = getAnthropic();
  const userPayload = [
    `Country: ${COUNTRY_LABELS_EN[params.countryCode]}`,
    `City/region: ${params.cityOrRegion ?? 'unspecified — pick the best beach-friendly study city in the country'}`,
    `Preferences: ${params.preferences.join(', ') || 'none'}`,
    '',
    'Search results (use as evidence, plus your general knowledge):',
    ...hits.map((h, i) =>
      [
        `[${i + 1}] ${h.title ?? 'Untitled'}`,
        `URL: ${h.url}`,
        h.description ? `Desc: ${h.description}` : '',
        h.markdown ? `Body excerpt: ${h.markdown.slice(0, 1500)}` : '',
        '---',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: userPayload }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === TOOL_NAME,
  );
  if (!toolUse) return { intel: null, sources: [] };

  const parsed = PayloadSchema.parse(toolUse.input);
  return {
    intel: parsed,
    sources: hits.map((h) => ({ url: h.url, title: h.title })),
  };
}
