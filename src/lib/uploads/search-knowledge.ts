import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import { createSignedDocumentUrl } from '@/lib/uploads/storage';
import { getServerSupabase } from '@/lib/supabase/local-client';
import type { Database } from '@/lib/supabase/database.types';
import type {
  KnowledgeEntityType,
  KnowledgeLookup,
  KnowledgeMatch,
  QuoteParams,
} from '@/types/quote';

type SearchKnowledgeReturn =
  Database['public']['Functions']['search_knowledge']['Returns'][number];

const ENTITY_TYPES = new Set<KnowledgeEntityType>([
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
]);

function toEntityType(raw: string): KnowledgeEntityType {
  return (ENTITY_TYPES.has(raw as KnowledgeEntityType)
    ? raw
    : 'other') as KnowledgeEntityType;
}

const STRONG_MATCH_THRESHOLD = 0.55;
const MIN_STRONG_MATCHES = 2;
const SEARCH_LIMIT = 16;

/**
 * Cache-first local lookup. Returns relevant entities ranked by:
 *   - field match score (country / course / age / school / city)
 *   - trigram similarity against title / summary / body
 *   - document validity & analyzer confidence
 *
 * Then a small Claude call decides whether the local result is "sufficient" or
 * if we should fall through to live web research.
 */
export async function searchKnowledgeForQuote(
  params: QuoteParams,
  promptText: string,
): Promise<KnowledgeLookup> {
  const supabase = getServerSupabase();
  const cleanedPrompt = promptText.trim();

  const { data, error } = await supabase.rpc('search_knowledge', {
    q: cleanedPrompt.slice(0, 400),
    p_country_code: params.countryCode,
    p_course_slug: params.courseSlug,
    p_age_bracket: params.ageBracket,
    p_school_name: params.schoolName ?? null,
    p_city: params.cityOrRegion ?? null,
    p_limit: SEARCH_LIMIT,
  });

  if (error) {
    console.warn('[knowledge] search_knowledge rpc error', error);
    return {
      matches: [],
      totalMatches: 0,
      sufficient: false,
      rationaleJa: 'ローカルナレッジ検索でエラーが発生しました。Web検索にフォールバックします。',
    };
  }

  const rows = (data ?? []) as SearchKnowledgeReturn[];
  const matches = await Promise.all(rows.map(toKnowledgeMatch));
  const sufficient = isSufficient(matches);
  await logSearch(promptText, params, matches);

  if (matches.length === 0) {
    return {
      matches,
      totalMatches: 0,
      sufficient: false,
      rationaleJa:
        'ローカルナレッジに該当する資料が見つかりませんでした。Web検索を行います。',
    };
  }

  const rationaleJa = await judgeSufficiency({
    params,
    promptText,
    matches,
    heuristicSufficient: sufficient,
  });

  return {
    matches,
    totalMatches: matches.length,
    sufficient,
    rationaleJa,
  };
}

async function toKnowledgeMatch(row: SearchKnowledgeReturn): Promise<KnowledgeMatch> {
  const signedUrl = await createSignedDocumentUrl(row.doc_storage_path);
  return {
    entityId: row.entity_id,
    entityType: toEntityType(row.entity_type),
    title: row.title,
    summary: row.summary ?? null,
    body: row.body ?? null,
    countryCode: row.country_code ?? null,
    courseSlug: row.course_slug ?? null,
    schoolName: row.school_name ?? null,
    cityOrRegion: row.city_or_region ?? null,
    currencyCode: row.currency_code ?? null,
    amount: row.amount ?? null,
    amountUnit: row.amount_unit ?? null,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    aiConfidence: row.ai_confidence ?? null,
    score: row.score,
    source: {
      documentId: row.document_id,
      filename: row.doc_filename,
      mimeType: row.doc_mime_type,
      storagePath: row.doc_storage_path,
      title: row.doc_title ?? null,
      sourceLabel: row.doc_source_label ?? null,
      tags: row.doc_tags ?? [],
      signedUrl,
    },
  };
}

function isSufficient(matches: KnowledgeMatch[]): boolean {
  if (matches.length === 0) return false;
  const strong = matches.filter((m) => m.score >= STRONG_MATCH_THRESHOLD);
  if (strong.length >= MIN_STRONG_MATCHES) return true;
  // A single very strong school-level match is also acceptable.
  return strong.some((m) => m.entityType === 'school' && m.score >= 0.7)
    || strong.some((m) => m.entityType === 'price' && m.score >= 0.7);
}

async function logSearch(
  promptText: string,
  params: QuoteParams,
  matches: KnowledgeMatch[],
) {
  try {
    const supabase = getServerSupabase();
    await supabase.from('knowledge_search_log').insert({
      prompt_text: promptText,
      parsed_params:
        params as unknown as Database['public']['Tables']['knowledge_search_log']['Insert']['parsed_params'],
      match_count: matches.length,
      top_match_id: matches[0]?.entityId ?? null,
      used_in_response: false,
    });
  } catch (err) {
    console.warn('[knowledge] failed to log search', err);
  }
}

interface JudgeInput {
  params: QuoteParams;
  promptText: string;
  matches: KnowledgeMatch[];
  heuristicSufficient: boolean;
}

/**
 * Tiny Claude call (200 tokens) that writes a 1-2 sentence Japanese rationale
 * explaining WHY we matched (or didn't) given the user's parameters. Used in
 * the UI as a citation note above the source documents.
 */
async function judgeSufficiency(input: JudgeInput): Promise<string> {
  if (input.matches.length === 0) {
    return 'ローカル資料に該当が無く、Web検索を行います。';
  }
  const anthropic = getAnthropic();
  const lines = input.matches.slice(0, 6).map((m, i) => {
    const validity =
      m.validFrom || m.validTo
        ? ` (有効: ${m.validFrom ?? '?'} 〜 ${m.validTo ?? '?'})`
        : '';
    const price =
      m.amount != null
        ? ` ${m.currencyCode ?? ''}${m.amount.toLocaleString()}${m.amountUnit ? `/${m.amountUnit}` : ''}`
        : '';
    return `${i + 1}. [${m.entityType}] ${m.title}${price}${validity} — ${m.summary ?? ''} (score=${m.score.toFixed(2)})`;
  });
  const userMessage = [
    '# Counselor prompt',
    input.promptText,
    '',
    '# Parsed params',
    JSON.stringify({
      countryCode: input.params.countryCode,
      courseSlug: input.params.courseSlug,
      age: input.params.age,
      durationWeeks: input.params.durationWeeks,
      schoolName: input.params.schoolName ?? null,
      cityOrRegion: input.params.cityOrRegion ?? null,
      budgetJpy: input.params.budgetJpy ?? null,
      preferences: input.params.preferences,
    }),
    '',
    '# Top local knowledge matches',
    ...lines,
    '',
    `# Heuristic: ${input.heuristicSufficient ? 'sufficient' : 'partial / supplement-with-web'}`,
  ].join('\n');

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 220,
      system:
        'あなたは留学エージェント「かえる留学」の社内ナレッジ判定AIです。' +
        '与えられたカウンセラーのプロンプトとローカルナレッジマッチを見て、' +
        '日本語で1〜2文の判定理由を返してください。' +
        'マッチが十分なら「該当する情報がローカルに見つかりました」のように肯定し、' +
        '部分的なら「不足している項目」を1つ挙げてください。' +
        '前置きや箇条書きは不要。',
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || (input.heuristicSufficient
      ? 'ローカル資料で十分な情報が見つかりました。'
      : 'ローカル資料に部分一致あり。Web検索で補完します。');
  } catch {
    return input.heuristicSufficient
      ? 'ローカル資料で十分な情報が見つかりました。'
      : 'ローカル資料に部分一致あり。Web検索で補完します。';
  }
}
