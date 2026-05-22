'use client';

import { Badge } from '@/components/ui/badge';
import { SectionShell } from '@/components/sections/section-shell';
import { formatJpy } from '@/lib/utils/format-currency';
import type { BudgetFit } from '@/types/quote';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Lightbulb, Wallet } from 'lucide-react';

interface BudgetMeterProps {
  budget: BudgetFit | null;
}

export function BudgetMeter({ budget }: BudgetMeterProps) {
  if (!budget) {
    return (
      <SectionShell title="Budget Fit" subtitle="予算判定" accent="rose">
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          予算が指定されていません。プロンプトに「予算¥100,000」のように追加すると判定を表示します。
        </p>
      </SectionShell>
    );
  }

  const pct = Math.max(0, Math.min(200, (budget.estimatedTotalJpy / Math.max(1, budget.budgetJpy)) * 100));
  const fits = budget.fits;
  const barColor = fits
    ? 'from-emerald-400 to-teal-300'
    : pct < 150
      ? 'from-amber-400 to-orange-300'
      : 'from-rose-500 to-red-400';

  return (
    <SectionShell
      title="Budget Fit"
      subtitle="予算判定"
      accent={fits ? 'emerald' : 'rose'}
      trailing={
        <Badge variant={fits ? 'local' : 'warn'}>
          {fits ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {fits ? '予算内' : '予算超過'}
        </Badge>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="ご予算" value={formatJpy(budget.budgetJpy)} icon={<Wallet className="h-3.5 w-3.5" />} />
          <Stat
            label="見積もり総額"
            value={formatJpy(budget.estimatedTotalJpy)}
            emphasis
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>予算消化率</span>
            <span className="tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, pct)}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barColor}`}
            />
            {pct > 100 ? (
              <div className="absolute inset-y-0 right-0 w-px bg-white/30" />
            ) : null}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.02] p-3 text-sm text-slate-100">{budget.verdict}</div>

        {budget.recommendations.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {budget.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2.5 text-xs text-slate-300"
              >
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionShell>
  );
}

function Stat({
  label,
  value,
  icon,
  emphasis,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? 'rounded-xl border border-violet-400/30 bg-violet-500/10 p-3'
          : 'rounded-xl bg-white/[0.02] p-3'
      }
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
