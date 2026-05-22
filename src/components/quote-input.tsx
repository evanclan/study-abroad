'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { ArrowUpRight, Sparkles, Command } from 'lucide-react';
import { motion } from 'motion/react';
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const EXAMPLES = [
  '35歳女性、日本沖縄、ビーチ近くの語学学校、2週間、英語コース、アパート希望、予算¥100,000',
  'オーストラリア、14歳、高校、サマーキャンプコース、1年',
  'Vancouver, 17歳, 語学学校, 6ヶ月, ホームステイ',
  'フィリピン セブ 19歳 語学学校 3ヶ月 予算30万円',
  'London, 22 years old, university, 12 months, share house near tube',
];

interface QuoteInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export function QuoteInput({ onSubmit, disabled }: QuoteInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler as EventListener);
    return () => window.removeEventListener('keydown', handler as EventListener);
  }, []);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = value.trim();
      if (trimmed.length < 2 || disabled) return;
      onSubmit(trimmed);
    },
    [value, onSubmit, disabled],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'relative overflow-hidden rounded-3xl border bg-white/[0.03] p-4 backdrop-blur-xl transition-colors',
          focused
            ? 'border-violet-400/40 shadow-[0_0_80px_-30px_rgba(167,139,250,0.6)]'
            : 'border-white/10',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 ring-1 ring-inset ring-violet-300/30">
            <Sparkles className="h-4 w-4 text-violet-100" />
          </div>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={disabled}
            placeholder="例: オーストラリア 14歳 高校 サマーキャンプ 1年"
            className={cn(
              'flex-1 resize-none bg-transparent text-base font-medium text-white placeholder:text-slate-500',
              'focus:outline-none disabled:opacity-50',
            )}
          />
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              type="submit"
              disabled={disabled || value.trim().length < 2}
              className="gap-1"
            >
              見積もりを生成
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <Command className="h-3 w-3" />
              K でフォーカス
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setValue(example)}
              disabled={disabled}
              className="rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </motion.div>
    </form>
  );
}
