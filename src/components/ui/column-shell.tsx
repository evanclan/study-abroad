'use client';

import { cn } from '@/lib/utils/cn';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export type ColumnAccent = 'slate' | 'sky' | 'emerald' | 'violet' | 'amber';

interface ColumnShellProps {
  title: string;
  subtitle?: string;
  index: number;
  accent?: ColumnAccent;
  trailing?: ReactNode;
  children: ReactNode;
}

const ACCENT_GLOW: Record<ColumnAccent, string> = {
  slate: 'before:bg-slate-400/40',
  sky: 'before:bg-sky-400/60',
  emerald: 'before:bg-emerald-400/60',
  violet: 'before:bg-violet-400/60',
  amber: 'before:bg-amber-400/60',
};

const ACCENT_LABEL: Record<ColumnAccent, string> = {
  slate: 'text-slate-300',
  sky: 'text-sky-300',
  emerald: 'text-emerald-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
};

export function ColumnShell({
  title,
  subtitle,
  index,
  accent = 'slate',
  trailing,
  children,
}: ColumnShellProps) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 50 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.08,
      }}
      className={cn(
        'relative flex w-[340px] shrink-0 flex-col gap-4 rounded-3xl border border-white/5',
        'bg-gradient-to-b from-white/[0.04] via-white/[0.02] to-transparent p-5 backdrop-blur-xl',
        'before:absolute before:-top-px before:left-6 before:right-6 before:h-px before:rounded-full',
        ACCENT_GLOW[accent],
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.22em]',
              ACCENT_LABEL[accent],
            )}
          >
            {String(index + 1).padStart(2, '0')} · {title}
          </span>
          {subtitle ? (
            <p className="text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {trailing}
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </motion.section>
  );
}
