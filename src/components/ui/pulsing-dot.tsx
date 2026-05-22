import { cn } from '@/lib/utils/cn';

interface PulsingDotProps {
  color?: 'sky' | 'emerald' | 'rose';
  className?: string;
}

const COLOR_STYLES: Record<NonNullable<PulsingDotProps['color']>, string> = {
  sky: 'bg-sky-400 shadow-[0_0_0_4px_rgba(56,189,248,0.18)]',
  emerald: 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]',
  rose: 'bg-rose-400 shadow-[0_0_0_4px_rgba(251,113,133,0.18)]',
};

export function PulsingDot({ color = 'sky', className }: PulsingDotProps) {
  return (
    <span
      className={cn(
        'relative inline-flex h-2 w-2 items-center justify-center rounded-full',
        COLOR_STYLES[color],
        className,
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
          color === 'sky' && 'bg-sky-400',
          color === 'emerald' && 'bg-emerald-400',
          color === 'rose' && 'bg-rose-400',
        )}
      />
    </span>
  );
}
