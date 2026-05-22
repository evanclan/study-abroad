import { CLAUDE_MODEL, getAnthropic } from '@/lib/ai/anthropic-client';
import type {
  AccommodationOption,
  ActivityItem,
  BudgetFit,
  LocationIntel,
  QuoteCosts,
  QuoteParams,
  SchoolCard,
} from '@/types/quote';

interface InsightChunk {
  summaryDelta?: string;
  suggestion?: string;
}

interface GenerateInsightsInput {
  params: QuoteParams;
  costs: QuoteCosts;
  schoolName: string | null;
  sourceUrl: string | null;
  schools: SchoolCard[];
  accommodations: AccommodationOption[];
  activities: ActivityItem[];
  location: LocationIntel | null;
  budgetFit: BudgetFit | null;
}

const SYSTEM_PROMPT = `あなたはかえる留学のシニア留学カウンセラーです。学生のプロフィール、
費用、宿泊候補、街情報、アクティビティ、予算判定を踏まえ、保護者・学生が
即座に判断できる包括的なアドバイスを日本語で生成します。

出力フォーマットは厳密に下記に従ってください。各セクションの前後に必ず実際の
改行文字を挿入し、SUMMARY と各 SUGGESTION は必ず別の行で始めます。

SUMMARY: <4〜6文の総合サマリー。学校・街・宿泊・予算の各観点に必ず触れること>
SUGGESTION: <具体的かつ実行可能な助言1>
SUGGESTION: <具体的かつ実行可能な助言2>
SUGGESTION: <具体的かつ実行可能な助言3>
SUGGESTION: <具体的かつ実行可能な助言4>
SUGGESTION: <具体的かつ実行可能な助言5>
SUGGESTION: <具体的かつ実行可能な助言6>

絵文字は使わない。マークダウン記号は使わない。文末は「です/ます調」。
助言は予算・期間・年齢・希望（ビーチ近く等）と矛盾しないように具体化すること。`;

function buildUserPrompt(input: GenerateInsightsInput): string {
  const { params, costs, schoolName, sourceUrl, schools, accommodations, activities, location, budgetFit } = input;

  const schoolsBlock = schools.length === 0
    ? '(候補なし)'
    : schools
        .slice(0, 5)
        .map(
          (s) =>
            `- ${s.name} (${s.location ?? '?'}) ${
              s.weeklyTuition ? `週${s.weeklyTuition}${s.currencyCode ?? ''}` : ''
            } ${s.highlights.slice(0, 3).join(' / ')}`,
        )
        .join('\n');

  const accomBlock = accommodations.length === 0
    ? '(候補なし)'
    : accommodations
        .slice(0, 5)
        .map(
          (a) =>
            `- [${a.kind}] ${a.name} ${a.location ?? ''} ${
              a.pricePerWeek
                ? `週${a.pricePerWeek}${a.currencyCode ?? ''}`
                : a.pricePerMonth
                  ? `月${a.pricePerMonth}${a.currencyCode ?? ''}`
                  : a.pricePerNight
                    ? `1泊${a.pricePerNight}${a.currencyCode ?? ''}`
                    : ''
            } ${a.highlights.slice(0, 2).join(' / ')}`,
        )
        .join('\n');

  const actBlock = activities.length === 0
    ? '(なし)'
    : activities
        .slice(0, 6)
        .map((a) => `- [${a.category}] ${a.title}${a.priceJpy ? ` ¥${a.priceJpy}` : ''}`)
        .join('\n');

  return [
    `# 学生プロフィール`,
    `年齢: ${params.age}歳 (${params.ageBracket})`,
    `留学先: ${params.countryCode}${params.cityOrRegion ? ` / ${params.cityOrRegion}` : ''}`,
    `プログラム: ${params.courseSlug}`,
    `期間: ${params.durationWeeks}週間`,
    params.budgetJpy ? `予算: ¥${params.budgetJpy.toLocaleString()}` : '予算: 未指定',
    params.preferences.length ? `希望: ${params.preferences.join(', ')}` : '希望: なし',
    '',
    `# 主候補校`,
    schoolName ? `主候補: ${schoolName}` : '主候補: 未確定',
    sourceUrl ? `参考URL: ${sourceUrl}` : '',
    '',
    '# 費用 (現地通貨 → 円換算)',
    `授業料: ${costs.tuition.toLocaleString()} ${costs.currencyCode}`,
    `滞在費: ${costs.accommodation.toLocaleString()} ${costs.currencyCode}`,
    `入学金: ${costs.registration.toLocaleString()} ${costs.currencyCode}`,
    `その他: ${costs.otherFees.toLocaleString()} ${costs.currencyCode}`,
    `航空券概算: ¥${costs.flights.toLocaleString()}`,
    `保険概算: ¥${costs.insurance.toLocaleString()}`,
    `ビザ概算: ¥${costs.visa.toLocaleString()}`,
    `生活費概算: ¥${costs.livingExpenses.toLocaleString()}`,
    `合計（円換算）: ¥${Math.round(costs.totalJpy).toLocaleString()} (FX 1${costs.currencyCode}=¥${costs.fxRate.toFixed(2)})`,
    '',
    budgetFit
      ? `# 予算判定\n${budgetFit.verdict}\n${budgetFit.recommendations.map((r) => `- ${r}`).join('\n')}`
      : '',
    '',
    `# 学校候補リスト`,
    schoolsBlock,
    '',
    `# 宿泊候補`,
    accomBlock,
    '',
    `# アクティビティ候補`,
    actBlock,
    '',
    location
      ? `# 街情報 (${location.city}, ${location.country})\n` +
        `雰囲気: ${location.vibe ?? '-'}\n` +
        `気候: ${location.climateNote ?? '-'}\n` +
        `ビーチアクセス: ${location.beachAccess ?? '-'}\n` +
        `治安: ${location.safetyNote ?? '-'}\n` +
        `平均1日予算: ${location.averageDailyBudgetJpy ? `¥${location.averageDailyBudgetJpy.toLocaleString()}` : '-'}`
      : '',
    '',
    '上記すべての情報を踏まえ、保護者と学生がすぐ判断できる総合的な日本語アドバイスを生成してください。',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Streams insights chunk-by-chunk. The orchestrator turns each emitted summary
 * delta / suggestion into an SSE event so the AI column types out live.
 */
export async function* streamQuoteInsights(
  input: GenerateInsightsInput,
): AsyncGenerator<InsightChunk, { summary: string; suggestions: string[] }, void> {
  const anthropic = getAnthropic();

  const summary: string[] = [];
  const suggestions: string[] = [];

  type Mode = 'idle' | 'summary' | 'suggestion';
  let buffer = '';
  const state: { mode: Mode } = { mode: 'idle' };
  let currentSuggestion = '';

  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 1400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });

  for await (const event of stream) {
    if (
      event.type !== 'content_block_delta' ||
      event.delta.type !== 'text_delta'
    ) {
      continue;
    }

    buffer += event.delta.text;

    // Normalise: inject a newline before mid-buffer section markers so the
    // line-based parser can split cleanly.
    buffer = buffer
      .replace(/([^\n])SUMMARY:/g, '$1\nSUMMARY:')
      .replace(/([^\n])SUGGESTION:/g, '$1\nSUGGESTION:');

    let newlineIdx = buffer.indexOf('\n');
    while (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      const flushed = flushLine(line);
      if (flushed) yield flushed;
      newlineIdx = buffer.indexOf('\n');
    }

    if (
      state.mode === 'summary' &&
      buffer.length > 0 &&
      !looksLikeIncompleteMarker(buffer)
    ) {
      const delta = buffer;
      buffer = '';
      summary.push(delta);
      yield { summaryDelta: delta };
    }
  }

  if (buffer.length > 0) {
    const flushed = flushLine(buffer);
    if (flushed) yield flushed;
  }

  if (currentSuggestion.trim().length > 0) {
    const final = currentSuggestion.trim();
    suggestions.push(final);
  }

  return {
    summary: summary.join('').trim(),
    suggestions,
  };

  function looksLikeIncompleteMarker(buf: string): boolean {
    if (/(SUMMARY:|SUGGESTION:)/.test(buf)) return true;
    const trimmed = buf.trimEnd();
    return /(?:^|\n)(S|SU|SUM|SUMM|SUMMA|SUMMAR|SUMMARY|SUG|SUGG|SUGGE|SUGGES|SUGGEST|SUGGESTI|SUGGESTIO|SUGGESTION)$/.test(
      trimmed,
    );
  }

  function flushLine(rawLine: string): InsightChunk | null {
    const line = rawLine.trim();
    if (line.length === 0) return null;

    if (line.startsWith('SUMMARY:')) {
      state.mode = 'summary';
      const initial = line.slice('SUMMARY:'.length).trim();
      if (initial.length > 0) {
        summary.push(initial);
        return { summaryDelta: initial };
      }
      return null;
    }

    if (line.startsWith('SUGGESTION:')) {
      if (currentSuggestion.trim().length > 0) {
        const closed = currentSuggestion.trim();
        suggestions.push(closed);
        currentSuggestion = '';
      }
      state.mode = 'suggestion';
      currentSuggestion = line.slice('SUGGESTION:'.length).trim();
      if (currentSuggestion.length > 0) {
        const out = currentSuggestion;
        suggestions.push(out);
        currentSuggestion = '';
        return { suggestion: out };
      }
      return null;
    }

    if (state.mode === 'summary') {
      summary.push(line);
      return { summaryDelta: line };
    }

    if (state.mode === 'suggestion') {
      currentSuggestion = `${currentSuggestion} ${line}`.trim();
      return null;
    }

    return null;
  }
}
