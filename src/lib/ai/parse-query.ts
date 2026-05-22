import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { ageToBracket } from '@/lib/quote/age-bracket';
import {
  COURSE_SLUGS,
  type CourseSlug,
  type QuoteParams,
  type SupportedCountryCode,
} from '@/types/quote';
import { z } from 'zod';

const TOOL_NAME = 'submit_quote_params';

const SUPPORTED_COUNTRIES = [
  'AU',
  'US',
  'GB',
  'CA',
  'NZ',
  'IE',
  'MT',
  'PH',
  'JP',
] as const;

const ParamsSchema = z.object({
  countryCode: z.enum(SUPPORTED_COUNTRIES),
  courseSlug: z.enum(COURSE_SLUGS),
  age: z.number().int().min(0).max(120),
  durationWeeks: z.number().int().min(1).max(260),
  schoolName: z.string().optional(),
  cityOrRegion: z.string().optional(),
  preferences: z.array(z.string()).max(8).default([]),
  budgetJpy: z.number().int().nonnegative().optional(),
  language: z.enum(['ja', 'en']).default('ja'),
});

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit the structured quote parameters extracted from the counselor prompt. Capture EVERYTHING relevant — budget, city, lifestyle preferences, school name — not just the bare minimum.',
  input_schema: {
    type: 'object',
    properties: {
      countryCode: {
        type: 'string',
        enum: [...SUPPORTED_COUNTRIES],
        description: 'ISO-3166 alpha-2 code of the destination country.',
      },
      courseSlug: {
        type: 'string',
        enum: [...COURSE_SLUGS],
        description:
          'Programme type. Map "サマーキャンプ" -> summer_camp, "高校留学" -> highschool, "語学学校"/"language school"/"English course" -> language_school, "大学" -> university, "専門学校" -> vocational. Default to language_school for short-duration adult language study.',
      },
      age: {
        type: 'integer',
        minimum: 0,
        maximum: 120,
        description: 'Student age in years.',
      },
      durationWeeks: {
        type: 'integer',
        minimum: 1,
        maximum: 260,
        description:
          'Programme duration in WEEKS. Convert: "2 weeks"/"2週間"=2, "1ヶ月"=4, "3ヶ月"=12, "1年"=52.',
      },
      schoolName: {
        type: 'string',
        description: 'Specific school name if mentioned. Otherwise omit.',
      },
      cityOrRegion: {
        type: 'string',
        description:
          'City, prefecture, or region if mentioned (e.g. "Okinawa", "Cebu", "Brisbane", "湘南"). Infer if the user gave a strong geographic hint (beach -> coastal city in country).',
      },
      preferences: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Lifestyle / accommodation preferences as short English keywords. Examples: ["near beach", "apartment", "homestay", "private room", "vegan friendly", "female only dorm", "near nightlife", "quiet area", "with kitchen"]. Empty array if no preferences.',
      },
      budgetJpy: {
        type: 'integer',
        minimum: 0,
        description:
          'Maximum budget the counselor/student has, normalised to JPY. "100000"/"10万"/"100,000円" all mean 100000. If only a non-JPY budget is given, convert roughly (1 USD ≈ 155 JPY, 1 AUD ≈ 100 JPY). Omit if no budget mentioned.',
      },
      language: {
        type: 'string',
        enum: ['ja', 'en'],
        description: 'Detect whether the prompt is primarily in Japanese (ja) or English (en).',
      },
    },
    required: ['countryCode', 'courseSlug', 'age', 'durationWeeks'],
  },
};

const SYSTEM_PROMPT = `You are a parameter extractor for かえる留学, a Japanese study-abroad agency.
Counselors submit short natural-language prompts in Japanese, English, or mixed.
Always call the ${TOOL_NAME} tool with the most comprehensive set of parameters
you can infer. Make educated guesses for cityOrRegion when the user gives a
strong geographic hint (e.g. "beach school in Japan" -> Okinawa or Kamakura).

Country mapping:
- オーストラリア=AU, アメリカ=US, イギリス/UK=GB, カナダ=CA, ニュージーランド=NZ,
  アイルランド=IE, マルタ=MT, フィリピン=PH, 日本/Japan=JP.

Default fallbacks (use when ambiguous):
- If duration is unspecified: 4 weeks.
- If age is unspecified but "高校生" => 16, "大学生"/"college" => 21, "社会人" => 30.
- If course type is unspecified but the prompt mentions "English"/"英語"/"語学" => language_school.`;

export async function parseQuoteQuery(prompt: string): Promise<QuoteParams> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 768,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: 'tool_use' }> =>
      block.type === 'tool_use' && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error('Claude did not call the submit_quote_params tool.');
  }

  const parsed = ParamsSchema.parse(toolUse.input);
  const durationWeeks = parsed.durationWeeks;
  // Round to whole months for cache key stability; min 1.
  const durationMonths = Math.max(1, Math.round(durationWeeks / 4));

  return {
    countryCode: parsed.countryCode as SupportedCountryCode,
    courseSlug: parsed.courseSlug as CourseSlug,
    age: parsed.age,
    ageBracket: ageToBracket(parsed.age),
    durationMonths,
    durationWeeks,
    schoolName: parsed.schoolName,
    cityOrRegion: parsed.cityOrRegion,
    preferences: parsed.preferences,
    budgetJpy: parsed.budgetJpy,
    language: parsed.language,
  };
}
