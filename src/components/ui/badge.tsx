import { cn } from '@/lib/utils/cn';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type BadgeVariant = 'local' | 'live' | 'neutral' | 'warn' | 'accent';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  local:
    'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30',
  live: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-400/40',
  neutral:
    'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10',
  warn: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-400/30',
  accent:
    'bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-400/30',
};

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide',
        VARIANT_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {icon ? <span className="flex h-3.5 w-3.5 items-center">{icon}</span> : null}
      {children}
    </span>
  );
}
