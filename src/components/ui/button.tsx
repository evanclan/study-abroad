import { cn } from '@/lib/utils/cn';
import type { ComponentPropsWithoutRef } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'subtle';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_30px_-12px_rgba(217,70,239,0.6)] hover:from-violet-400 hover:to-fuchsia-400',
  ghost:
    'bg-white/[0.04] text-slate-100 ring-1 ring-inset ring-white/10 hover:bg-white/[0.08]',
  subtle: 'bg-transparent text-slate-300 hover:text-white',
};

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_STYLES[variant],
        className,
      )}
      {...rest}
    />
  );
}
