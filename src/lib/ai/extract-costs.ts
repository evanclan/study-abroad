import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import type { QuoteParams } from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_cost_extraction';

const ExtractionSchema = z.object({
  currencyCode: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase()),
  tuition: z.number().nonnegative().default(0),
  accommodation: z.number().nonnegative().default(0),
  registration: z.number().nonnegative().default(0),
  otherFees: z.number().nonnegative().default(0),
  schoolName: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

export type ExtractedCosts = z.infer<typeof ExtractionSchema>;

import type Anthropic from '@anthropic-ai/sdk';

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit a normalised cost breakdown for the requested programme based on the scraped page.',
  input_schema: {
    type: 'object',
    properties: {
      currencyCode: {
        type: 'string',
        description: 'ISO 4217 currency code of the prices (e.g. AUD, USD).',
      },
      tuition: { type: 'number', description: 'Tuition / course fee total for the requested duration.' },
      accommodation: {
        type: 'number',
        description: 'Accommodation total for the requested duration. 0 if not offered or not listed.',
      },
      registration: {
        type: 'number',
        description: 'One-time application / registration / enrolment fee.',
      },
      otherFees: {
        type: 'number',
        description:
          'Any other mandatory fees (materials, airport pickup, homestay placement, insurance, etc).',
      },
      schoolName: {
        type: 'string',
        description: 'The school / institution name as it appears on the page.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How confident you are that the breakdown is accurate.',
      },
    },
    required: ['currencyCode', 'tuition'],
  },
};

const SYSTEM_PROMPT = `You are a study-abroad pricing analyst. From the scraped markdown of a school
page, extract the total cost for the requested programme over the requested
duration. All fees are TOTALS for the full duration (not per-week). Convert
per-week amounts by multiplying. Use 0 when a fee is genuinely not applicable;
never invent numbers. Always call the ${TOOL_NAME} tool.`;

interface ExtractInput {
  params: QuoteParams;
  markdown: string;
  url: string;
}

export async function extractCostsFromScrape({
  params,
  markdown,
  url,
}: ExtractInput): Promise<ExtractedCosts> {
  const anthropic = getAnthropic();

  // Truncate to keep context costs predictable while preserving the pricing
  // sections (typically near the top of school pages).
  const trimmed = markdown.slice(0, 18_000);

  const userPrompt = [
    `Requested programme: ${params.courseSlug}`,
    `Destination country: ${params.countryCode}`,
    `Student age: ${params.age}`,
    `Duration: ${params.durationWeeks} weeks (~${params.durationMonths} month(s))`,
    `School (if specified): ${params.schoolName ?? 'n/a'}`,
    `City (if specified): ${params.cityOrRegion ?? 'n/a'}`,
    `Source URL: ${url}`,
    '',
    'Scraped page content:',
    '---',
    trimmed,
    '---',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: userPrompt }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: 'tool_use' }> =>
      block.type === 'tool_use' && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error('Claude did not return a cost extraction tool call.');
  }

  return ExtractionSchema.parse(toolUse.input);
}
