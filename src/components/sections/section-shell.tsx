'use client';

import { cn } from '@/lib/utils/cn';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface SectionShellProps {
  title: string;
  subtitle?: string;
  accent?: 'slate' | 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

const ACCENT_DOT: Record<NonNullable<SectionShellProps['accent']>, string> = {
  slate: 'bg-slate-400',
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

const ACCENT_TEXT: Record<NonNullable<SectionShellProps['accent']>, string> = {
  slate: 'text-slate-300',
  sky: 'text-sky-300',
  emerald: 'text-emerald-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
};

export function SectionShell({
  title,
  subtitle,
  accent = 'slate',
  trailing,
  className,
  children,
}: SectionShellProps) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-3xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className={cn('flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]', ACCENT_TEXT[accent])}>
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', ACCENT_DOT[accent])} />
            {title}
          </div>
          {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {trailing}
      </header>
      {children}
    </motion.section>
  );
}
