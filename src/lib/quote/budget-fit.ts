import type { BudgetFit, QuoteCosts, QuoteParams } from '@/types/quote';

interface Input {
  params: QuoteParams;
  costs: QuoteCosts;
}

/**
 * Pure budget-fit calculator. Compares the rolled-up JPY total to the user's
 * budget (if any) and returns a verdict plus concrete moves to bring the
 * numbers in line.
 *
 * No LLM call — we want this to render instantly the moment costs are known.
 */
export function computeBudgetFit({ params, costs }: Input): BudgetFit | null {
  if (!params.budgetJpy || params.budgetJpy <= 0) return null;

  const budget = params.budgetJpy;
  const total = Math.round(costs.totalJpy);
  const delta = total - budget;
  const fits = delta <= 0;
  const overshootRatio = budget > 0 ? delta / budget : 0;

  const lang = params.language;
  const verdict = lang === 'ja'
    ? fits
      ? `予算内に収まります。残り ¥${Math.abs(delta).toLocaleString()}`
      : `予算超過 ¥${delta.toLocaleString()}（${Math.round(overshootRatio * 100)}%オーバー）`
    : fits
      ? `Within budget. ¥${Math.abs(delta).toLocaleString()} remaining.`
      : `Over budget by ¥${delta.toLocaleString()} (${Math.round(overshootRatio * 100)}%).`;

  const recommendations: string[] = [];
  if (!fits) {
    if (params.durationWeeks > 2) {
      recommendations.push(
        lang === 'ja'
          ? `期間を${params.durationWeeks}週間 → ${Math.max(1, Math.floor(params.durationWeeks / 2))}週間に短縮すると約半分の費用になります。`
          : `Shorten the stay from ${params.durationWeeks} to ${Math.max(1, Math.floor(params.durationWeeks / 2))} weeks to roughly halve the cost.`,
      );
    }
    if (costs.accommodation > 0) {
      recommendations.push(
        lang === 'ja'
          ? '宿泊先をドミトリーまたはゲストハウスに変更し、月3〜5万円節約。'
          : 'Switch accommodation to a dorm or guesthouse to save ~¥30,000-¥50,000/month.',
      );
    }
    recommendations.push(
      lang === 'ja'
        ? '航空券は2〜3ヶ月前のLCC予約で半額になることが多いです。'
        : 'Booking flights 2-3 months ahead via LCCs often halves airfare.',
    );
    if (overshootRatio > 0.5) {
      recommendations.push(
        lang === 'ja'
          ? '予算と実費の差が大きいため、より物価が安い都市（フィリピン・セブ等）への変更も検討してください。'
          : 'Consider a lower-cost-of-living destination (e.g. Cebu, Philippines) since the gap is significant.',
      );
    }
  } else {
    recommendations.push(
      lang === 'ja'
        ? `余裕分の ¥${Math.abs(delta).toLocaleString()} で週末の小旅行やアクティビティに充てる余地があります。`
        : `Spare ¥${Math.abs(delta).toLocaleString()} could fund weekend trips or extra activities.`,
    );
  }

  return {
    budgetJpy: budget,
    estimatedTotalJpy: total,
    deltaJpy: delta,
    fits,
    verdict,
    recommendations,
  };
}
