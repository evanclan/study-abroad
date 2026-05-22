import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { firecrawlSearch } from '@/lib/firecrawl/multi-search';
import { COUNTRY_LABELS_EN } from '@/lib/quote/labels';
import type { ActivityItem, QuoteParams } from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_activities';

const ACTIVITY_CATEGORIES = [
  'event',
  'beach',
  'food',
  'culture',
  'nightlife',
  'nature',
  'shopping',
  'other',
] as const;

const ItemSchema = z
  .object({
    title: z.string(),
    url: z.string().url().optional().catch(undefined),
    category: z.enum(ACTIVITY_CATEGORIES).catch('other' as const),
    description: z.string().optional().catch(undefined),
    whenLabel: z.string().optional().catch(undefined),
    priceJpy: z.number().nonnegative().optional().catch(undefined),
  })
  .passthrough();

const PayloadSchema = z.object({
  activities: z.array(ItemSchema).max(12).default([]),
});

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit 5-8 things to do during the study period: events, beaches, food spots, cultural sites, nature activities. Use the provided search results plus general knowledge.',
  input_schema: {
    type: 'object',
    properties: {
      activities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            category: { type: 'string', enum: [...ACTIVITY_CATEGORIES] },
            description: { type: 'string' },
            whenLabel: {
              type: 'string',
              description: 'When the activity is best / season / dates if relevant',
            },
            priceJpy: { type: 'number', description: 'Approximate cost per person in JPY' },
          },
          required: ['title', 'category'],
        },
      },
    },
    required: ['activities'],
  },
};

const SYSTEM_PROMPT = `あなたは留学中の余暇プラン提案エージェントです。指定された街・国・
ご希望（ビーチ近く等）を踏まえ、留学期間中に楽しめる具体的なアクティビティ
（実在するイベント・ビーチ・グルメ店・文化体験・ナイトライフ・自然スポット・
ショッピング先）を**必ず6〜8件**提案してください。検索結果が無くてもあなたの
一般知識から提案できます。空のリストは絶対に返してはいけません。

各項目:
- title はその場所/イベントの実在する固有名詞（例: 「美ら海水族館」「国際通り」）
- category は適切な分類
- description は1〜2文の簡潔な紹介（日本語）
- whenLabel は時期/季節（任意）
- priceJpy は目安料金（任意、入場料・1人あたりの円換算）`;

interface ResearchInput {
  params: QuoteParams;
}

interface ResearchOutput {
  activities: ActivityItem[];
  sources: { url: string; title?: string }[];
}

function buildQuery(params: QuoteParams): string {
  const segments: string[] = [];
  segments.push('top');
  segments.push(params.cityOrRegion ?? '');
  segments.push(COUNTRY_LABELS_EN[params.countryCode]);
  segments.push('things to do attractions');
  if (params.preferences.some((p) => /beach|ocean|海/i.test(p))) segments.push('beaches');
  if (params.preferences.some((p) => /food|cafe|グルメ/i.test(p))) segments.push('food');
  return segments.filter(Boolean).join(' ');
}

export async function researchActivities({
  params,
}: ResearchInput): Promise<ResearchOutput> {
  const query = buildQuery(params);
  // Activities are forgiving — even if search returns nothing the LLM can
  // produce a strong general-knowledge list. Don't return early on 0 hits.
  const hits = await firecrawlSearch({ query, limit: 5, withMarkdown: true }).catch(() => []);

  const anthropic = getAnthropic();
  const userPayload = [
    `Country: ${COUNTRY_LABELS_EN[params.countryCode]}`,
    `City: ${params.cityOrRegion ?? 'flexible'}`,
    `Duration: ${params.durationWeeks} weeks`,
    `Age: ${params.age}`,
    `Preferences: ${params.preferences.join(', ') || 'none'}`,
    '',
    hits.length > 0
      ? 'Search results (combine with your general knowledge):'
      : 'No search hits returned — rely on your general knowledge. ALWAYS submit at least 6 activities.',
    ...hits.map((h, i) =>
      [
        `[${i + 1}] ${h.title ?? 'Untitled'}`,
        `URL: ${h.url}`,
        h.description ? `Desc: ${h.description}` : '',
        h.markdown ? `Body excerpt: ${h.markdown.slice(0, 1400)}` : '',
        '---',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1400,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: userPayload }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === TOOL_NAME,
  );
  if (!toolUse) return { activities: [], sources: [] };

  const parsed = PayloadSchema.parse(toolUse.input);
  const validUrls = new Set(hits.map((h) => h.url));
  const safe: ActivityItem[] = parsed.activities.map((a) => ({
    ...a,
    url: a.url && validUrls.has(a.url) ? a.url : undefined,
  }));

  return {
    activities: safe,
    sources: hits.map((h) => ({ url: h.url, title: h.title })),
  };
}
