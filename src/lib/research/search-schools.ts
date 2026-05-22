import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { firecrawlSearch } from '@/lib/firecrawl/multi-search';
import { COUNTRY_LABELS_EN } from '@/lib/quote/labels';
import type { QuoteParams, SchoolCard } from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_school_candidates';

const SchoolSchema = z
  .object({
    name: z.string().min(2),
    url: z.string().url(),
    description: z.string().optional().catch(undefined),
    weeklyTuition: z.number().nonnegative().optional().catch(undefined),
    totalEstimate: z.number().nonnegative().optional().catch(undefined),
    currencyCode: z.string().length(3).optional().catch(undefined),
    highlights: z.array(z.string()).max(8).default([]).catch([]),
    distanceToBeachKm: z.number().nonnegative().optional().catch(undefined),
    location: z.string().optional().catch(undefined),
    programs: z.array(z.string()).max(10).default([]).catch([]),
    ageRange: z.string().optional().catch(undefined),
  })
  .passthrough();

const PayloadSchema = z.object({
  schools: z.array(SchoolSchema).max(10).default([]),
});

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit 3-6 candidate schools that best match the student profile. Each entry must include a real URL drawn from the provided search results.',
  input_schema: {
    type: 'object',
    properties: {
      schools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: 'string' },
            description: { type: 'string' },
            weeklyTuition: { type: 'number' },
            totalEstimate: { type: 'number' },
            currencyCode: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            distanceToBeachKm: { type: 'number' },
            location: { type: 'string' },
            programs: { type: 'array', items: { type: 'string' } },
            ageRange: { type: 'string' },
          },
          required: ['name', 'url'],
        },
      },
    },
    required: ['schools'],
  },
};

const SYSTEM_PROMPT = `あなたはかえる留学のリサーチエージェントです。検索結果から学生の条件に
最も合う語学学校・専門学校・大学を3〜6校選び、構造化して返してください。
ビーチ近くなどの希望を考慮し、距離やロケーションに言及できる場合は明示します。
URLは必ず検索結果に含まれる実在URLを使い、価格は分かれば現地通貨で記入します。
不明な場合はフィールドを省略してください。架空のURLは絶対に作らないこと。`;

interface ResearchInput {
  params: QuoteParams;
}

interface ResearchOutput {
  schools: SchoolCard[];
  sources: { url: string; title?: string }[];
}

function buildQuery(params: QuoteParams): string {
  const parts: string[] = [];
  if (params.schoolName) parts.push(params.schoolName);
  if (params.cityOrRegion) parts.push(params.cityOrRegion);
  parts.push(COUNTRY_LABELS_EN[params.countryCode]);
  if (params.preferences.some((p) => /beach|beach|near beach|ocean|coast/i.test(p))) {
    parts.push('near beach');
  }
  parts.push('English language school international students');
  parts.push('tuition fees');
  return parts.filter(Boolean).join(' ');
}

export async function researchSchools({ params }: ResearchInput): Promise<ResearchOutput> {
  const query = buildQuery(params);
  // Use scraping so the LLM has page bodies to extract weekly tuition from.
  const hits = await firecrawlSearch({ query, limit: 5, withMarkdown: true });
  if (hits.length === 0) {
    return { schools: [], sources: [] };
  }

  const anthropic = getAnthropic();
  const userPayload = [
    `Student profile:`,
    `  Age: ${params.age}`,
    `  Country: ${COUNTRY_LABELS_EN[params.countryCode]}`,
    `  City: ${params.cityOrRegion ?? 'flexible'}`,
    `  Duration: ${params.durationWeeks} weeks`,
    `  Preferences: ${params.preferences.join(', ') || 'none'}`,
    `  Budget (JPY): ${params.budgetJpy ?? 'unspecified'}`,
    '',
    `Search results to choose from:`,
    ...hits.map((h, i) =>
      [
        `[${i + 1}] ${h.title ?? 'Untitled'}`,
        `URL: ${h.url}`,
        h.description ? `Desc: ${h.description}` : '',
        h.markdown ? `Body excerpt: ${h.markdown.slice(0, 2500)}` : '',
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
    messages: [{ role: 'user', content: userPayload }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === TOOL_NAME,
  );

  if (!toolUse) return { schools: [], sources: [] };

  const parsed = PayloadSchema.parse(toolUse.input);
  const validUrls = new Set(hits.map((h) => h.url));
  const safeSchools: SchoolCard[] = parsed.schools.filter((s) => validUrls.has(s.url));

  return {
    schools: safeSchools,
    sources: hits.map((h) => ({ url: h.url, title: h.title })),
  };
}
