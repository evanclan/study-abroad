import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface IconPillProps {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: 'sky' | 'emerald' | 'violet' | 'amber' | 'slate';
}

const ACCENT_RING: Record<NonNullable<IconPillProps['accent']>, string> = {
  sky: 'ring-sky-400/30 text-sky-300',
  emerald: 'ring-emerald-400/30 text-emerald-300',
  violet: 'ring-violet-400/30 text-violet-300',
  amber: 'ring-amber-400/30 text-amber-300',
  slate: 'ring-white/10 text-slate-300',
};

export function IconPill({ icon, label, value, accent = 'slate' }: IconPillProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-inset',
          ACCENT_RING[accent],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="truncate text-sm font-medium text-slate-100">{value}</div>
      </div>
    </div>
  );
}
