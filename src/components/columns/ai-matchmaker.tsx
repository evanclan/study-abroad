'use client';

import { Badge } from '@/components/ui/badge';
import { ColumnShell } from '@/components/ui/column-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface AiMatchmakerProps {
  summary: string;
  suggestions: string[];
  isStreaming: boolean;
}

export function AiMatchmaker({
  summary,
  suggestions,
  isStreaming,
}: AiMatchmakerProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setChecked((c) => ({ ...c, [i]: !c[i] }));

  const hasContent = summary.length > 0 || suggestions.length > 0;

  return (
    <ColumnShell
      title="AI Strategic Matchmaker"
      subtitle="カウンセラー向けインサイト"
      index={3}
      accent="sky"
      trailing={
        <Badge variant="accent">
          <Sparkles className="h-3 w-3" />
          Claude
        </Badge>
      }
    >
      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-violet-300">
          サマリー
        </div>
        {summary.length > 0 ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">
            {summary}
            {isStreaming ? (
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="ml-0.5 inline-block h-3 w-1.5 align-middle bg-violet-300"
              />
            ) : null}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3 w-[80%]" />
            <Skeleton className="h-3 w-[65%]" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          アクションリスト
        </div>
        {suggestions.length === 0 && !hasContent ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px]" />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {suggestions.map((s, i) => (
              <motion.button
                key={`${i}-${s.slice(0, 16)}`}
                type="button"
                onClick={() => toggle(i)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                {checked[i] ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                )}
                <span
                  className={
                    checked[i]
                      ? 'text-sm leading-relaxed text-slate-400 line-through'
                      : 'text-sm leading-relaxed text-slate-100'
                  }
                >
                  {s}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </ColumnShell>
  );
}
