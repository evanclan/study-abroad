import type Anthropic from '@anthropic-ai/sdk';

import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';

const TOOL_NAME = 'submit_document_analysis';

export const ENTITY_TYPES = [
  'school',
  'price',
  'campaign',
  'accommodation',
  'activity',
  'location',
  'rule',
  'contact',
  'program',
  'visa',
  'insurance',
  'flight',
  'note',
  'other',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const SUPPORTED_COUNTRIES = [
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

export const COURSE_SLUGS = [
  'summer_camp',
  'highschool',
  'language_school',
  'university',
  'vocational',
] as const;

export const AGE_BRACKETS = ['0-12', '13-15', '16-18', '19-25', '26+'] as const;

export interface AnalyzedEntity {
  entityType: EntityType;
  title: string;
  summary: string;
  body: string;
  countryCode?: string | null;
  courseSlug?: string | null;
  schoolName?: string | null;
  cityOrRegion?: string | null;
  currencyCode?: string | null;
  amount?: number | null;
  amountUnit?: string | null;
  durationWeeks?: number | null;
  ageBracket?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  confidence: number;
  data?: Record<string, unknown> | null;
}

export interface DocumentAnalysis {
  summaryJa: string;
  keywords: string[];
  countryCodes: string[];
  courseSlugs: string[];
  schoolName?: string | null;
  cityOrRegion?: string | null;
  currencyCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  confidence: number;
  entities: AnalyzedEntity[];
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Submit the full structured analysis of a supplier / agency document. Capture EVERY price, school, campaign, rule, accommodation, activity, contact, and location atom that appears in the text. Use the Japanese summary for the counselor-facing label.',
  input_schema: {
    type: 'object',
    properties: {
      // NOTE: `entities` is intentionally first. Claude generates tool input
      // top-to-bottom, and entity arrays are by far the biggest field. If we
      // put metadata first, a long document can exhaust max_tokens before
      // any entities are produced — resulting in a fully-analyzed row with
      // zero matchable atoms.
      entities: {
        type: 'array',
        description:
          '資料内の全ての"アトム"。各アトムは1件の学校, 1つの価格, 1つのキャンペーン, 1つの宿泊オプションなど、独立して検索可能な単位。',
        items: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: [...ENTITY_TYPES],
            },
            title: {
              type: 'string',
              description: 'カウンセラーが見て即理解できる日本語/英語ラベル。',
            },
            summary: {
              type: 'string',
              description: '1〜2文の日本語要約。',
            },
            body: {
              type: 'string',
              description:
                'このアトムを後で再現するのに十分な原文の引用 (引用範囲は500文字以内推奨)。',
            },
            countryCode: { type: 'string', enum: [...SUPPORTED_COUNTRIES] },
            courseSlug: { type: 'string', enum: [...COURSE_SLUGS] },
            schoolName: { type: 'string' },
            cityOrRegion: { type: 'string' },
            currencyCode: { type: 'string' },
            amount: {
              type: 'number',
              description: '金額 (現地通貨)。',
            },
            amountUnit: {
              type: 'string',
              enum: [
                'per_week',
                'per_month',
                'per_night',
                'per_year',
                'per_session',
                'total',
                'one_time',
                'discount',
                'other',
              ],
              description: '金額の単位。',
            },
            durationWeeks: {
              type: 'integer',
              minimum: 1,
            },
            ageBracket: {
              type: 'string',
              enum: [...AGE_BRACKETS],
            },
            validFrom: { type: 'string' },
            validTo: { type: 'string' },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
            },
            data: {
              type: 'object',
              description:
                '構造化された生データ。例: {"includes": ["tuition", "homestay"], "exclusions": ["airport pickup"]}。',
              additionalProperties: true,
            },
          },
          required: ['entityType', 'title', 'summary', 'body', 'confidence'],
        },
      },
      summaryJa: {
        type: 'string',
        description:
          '1〜3文の日本語要約。資料の全体像をかえる留学カウンセラーが3秒で理解できるように書く。',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description:
          'この資料を検索ヒットさせるための日本語/英語キーワード(最大15)。"オーストラリア", "Brisbane", "summer camp", "homestay" 等。',
      },
      countryCodes: {
        type: 'array',
        items: { type: 'string', enum: [...SUPPORTED_COUNTRIES] },
        description: '資料で言及されている全ての国コード (ISO-3166 alpha-2)。',
      },
      courseSlugs: {
        type: 'array',
        items: { type: 'string', enum: [...COURSE_SLUGS] },
        description: '該当するコース種類のスラッグ。',
      },
      schoolName: {
        type: 'string',
        description: '中心となる学校名 (もしあれば)。',
      },
      cityOrRegion: {
        type: 'string',
        description: '中心都市 / 地域。"Brisbane", "沖縄", "Cebu" 等。',
      },
      currencyCode: {
        type: 'string',
        description: '価格表が使用する主な通貨コード (ISO-4217)。',
      },
      validFrom: {
        type: 'string',
        description: '有効期間の開始日 (YYYY-MM-DD)。キャンペーンや料金表で重要。',
      },
      validTo: {
        type: 'string',
        description: '有効期間の終了日 (YYYY-MM-DD)。',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: '抽出の自信度 (0..1)。',
      },
    },
    required: ['entities', 'summaryJa', 'keywords', 'confidence'],
  },
};

const SYSTEM_PROMPT = `あなたは留学エージェント「かえる留学」の社内ナレッジベース構築AIです。
カウンセラーがアップロードした PDF/Word/Excel/画像/テキスト の中身が与えられます。

あなたの仕事:
1. 資料の意味を理解し、日本語で短く要約する。
2. 検索でヒットさせるためのキーワードを最大15個生成する。
3. **資料内の独立した情報単位 (entity) をすべて抽出する**。
   - 学校情報 → school
   - 価格情報 (授業料, 宿泊費, 登録料, ホームステイ料金など) → price / accommodation
   - キャンペーン / 割引 / 期間限定オファー → campaign
   - 連絡先 (担当者, メール, 電話) → contact
   - ルール (キャンセルポリシー, 入学条件) → rule
   - 観光・アクティビティ → activity
   - 都市・地域情報 → location
   - プログラム/コース → program
   - 航空券 → flight, 保険 → insurance, ビザ → visa
4. 価格は **必ず現地通貨でそのまま** 記録する。換算しない。
5. データが資料に書いていない場合は無理に推測しない。空欄でよい。
6. 金額単位 (週/月/年/合計) を必ず指定する。
7. \`body\` フィールドには原文の引用を入れる (カウンセラーが後で文脈を辿れるように)。
8. すべての答えは ${TOOL_NAME} ツール 1 回の呼び出しで返す。
9. 国コード/コーススラッグは指定された enum から選ぶ。判別不能なら省略。
10. validFrom/validTo は YYYY-MM-DD 形式。期間が明記されていなければ省略。`;

const MAX_INPUT_CHARS = 24000;

/**
 * Run Claude tool-use to convert raw extracted text into structured entities.
 * The text can be long (full PDF) so we cap it at MAX_INPUT_CHARS and tell the
 * model that it's a window into a larger document.
 */
export async function analyzeDocument(input: {
  filename: string;
  mimeType: string;
  extractedText: string;
  sourceLabel?: string;
  description?: string;
  tags?: string[];
}): Promise<DocumentAnalysis> {
  const anthropic = getAnthropic();
  const text = (input.extractedText || '').trim();

  if (text.length === 0) {
    return emptyAnalysis('テキストが抽出できませんでした。');
  }

  const truncated = text.length > MAX_INPUT_CHARS;
  const window = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;

  const userMessage = [
    `# Filename`,
    input.filename,
    '',
    `# MIME type`,
    input.mimeType,
    '',
    input.sourceLabel ? `# Source label\n${input.sourceLabel}\n` : '',
    input.description ? `# Counselor note\n${input.description}\n` : '',
    input.tags?.length ? `# Tags\n${input.tags.join(', ')}\n` : '',
    `# Extracted text${truncated ? ' (truncated to first 24k chars)' : ''}`,
    window,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    // A rich price-list PDF can produce 30+ entities × ~300 tokens each, plus
    // metadata; cap generously so we never silently truncate the entities
    // array mid-stream.
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: userMessage }],
  });
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      '[analyze-document] Claude hit max_tokens — entity array may be truncated.',
    );
  }

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error('AI did not return a tool_use result for the document analysis.');
  }

  return normalize(toolUse.input as Record<string, unknown>);
}

function emptyAnalysis(summary: string): DocumentAnalysis {
  return {
    summaryJa: summary,
    keywords: [],
    countryCodes: [],
    courseSlugs: [],
    confidence: 0,
    entities: [],
  };
}

function normalize(raw: Record<string, unknown>): DocumentAnalysis {
  const entitiesRaw = Array.isArray(raw.entities) ? raw.entities : [];
  const entities: AnalyzedEntity[] = entitiesRaw
    .map(normalizeEntity)
    .filter((e): e is AnalyzedEntity => e !== null);

  return {
    summaryJa: asString(raw.summaryJa) ?? '',
    keywords: asStringArray(raw.keywords).slice(0, 25),
    countryCodes: asStringArray(raw.countryCodes).filter((c) =>
      (SUPPORTED_COUNTRIES as readonly string[]).includes(c),
    ),
    courseSlugs: asStringArray(raw.courseSlugs).filter((s) =>
      (COURSE_SLUGS as readonly string[]).includes(s),
    ),
    schoolName: asString(raw.schoolName) ?? null,
    cityOrRegion: asString(raw.cityOrRegion) ?? null,
    currencyCode: asString(raw.currencyCode) ?? null,
    validFrom: asDate(raw.validFrom),
    validTo: asDate(raw.validTo),
    confidence: clampNumber(raw.confidence, 0, 1) ?? 0.5,
    entities,
  };
}

function normalizeEntity(raw: unknown): AnalyzedEntity | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const entityType = asString(r.entityType);
  if (!entityType || !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return null;
  }
  const title = asString(r.title);
  if (!title) return null;

  return {
    entityType: entityType as EntityType,
    title,
    summary: asString(r.summary) ?? '',
    body: asString(r.body) ?? '',
    countryCode: asEnum(r.countryCode, SUPPORTED_COUNTRIES),
    courseSlug: asEnum(r.courseSlug, COURSE_SLUGS),
    schoolName: asString(r.schoolName) ?? null,
    cityOrRegion: asString(r.cityOrRegion) ?? null,
    currencyCode: asString(r.currencyCode) ?? null,
    amount: asNumber(r.amount),
    amountUnit: asString(r.amountUnit) ?? null,
    durationWeeks: asInt(r.durationWeeks),
    ageBracket: asEnum(r.ageBracket, AGE_BRACKETS),
    validFrom: asDate(r.validFrom),
    validTo: asDate(r.validTo),
    confidence: clampNumber(r.confidence, 0, 1) ?? 0.5,
    data: (r.data && typeof r.data === 'object'
      ? (r.data as Record<string, unknown>)
      : null),
  };
}

function asString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function asNumber(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

function asInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v);
}

function clampNumber(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

function asEnum<T extends readonly string[]>(
  v: unknown,
  values: T,
): T[number] | null {
  if (typeof v !== 'string') return null;
  return (values as readonly string[]).includes(v) ? (v as T[number]) : null;
}

function asDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const match = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
