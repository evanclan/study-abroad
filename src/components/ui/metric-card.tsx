import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  primary: string;
  secondary?: string;
  emphasis?: 'default' | 'total';
  icon?: ReactNode;
  hint?: string;
}

export function MetricCard({
  label,
  primary,
  secondary,
  emphasis = 'default',
  icon,
  hint,
}: MetricCardProps) {
  const isTotal = emphasis === 'total';

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl border border-white/5 bg-white/[0.02] p-4',
        isTotal &&
          'border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent shadow-[0_0_40px_-12px_rgba(167,139,250,0.45)]',
      )}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
        <span className="flex items-center gap-2">
          {icon ? <span className="text-slate-300">{icon}</span> : null}
          {label}
        </span>
        {hint ? <span className="text-[10px] text-slate-500">{hint}</span> : null}
      </div>
      <div
        className={cn(
          'mt-1 font-medium tabular-nums',
          isTotal ? 'text-3xl text-white' : 'text-xl text-slate-100',
        )}
      >
        {primary}
      </div>
      {secondary ? (
        <div className="text-xs tabular-nums text-slate-400">{secondary}</div>
      ) : null}
    </div>
  );
}
