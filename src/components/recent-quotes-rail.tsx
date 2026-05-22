'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentQuotes } from '@/hooks/use-recent-quotes';
import {
  COUNTRY_FLAGS,
  COUNTRY_LABELS_JA,
  COURSE_LABELS_JA,
} from '@/lib/quote/labels';
import { formatRelativeJa } from '@/lib/utils/format-currency';
import { History } from 'lucide-react';
import { motion } from 'motion/react';

interface RecentQuotesRailProps {
  refreshKey: unknown;
  onPick: (prompt: string) => void;
}

export function RecentQuotesRail({ refreshKey, onPick }: RecentQuotesRailProps) {
  const { items, loading } = useRecentQuotes(refreshKey);

  return (
    <aside className="flex w-full max-w-xs flex-col gap-3 rounded-3xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-xl xl:w-72">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          最近の検索
        </span>
        <span className="text-[10px] text-slate-500">{items.length}件</span>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          まだ検索履歴がありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => onPick(item.promptText)}
                className="group flex w-full flex-col gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">
                    {COUNTRY_FLAGS[item.countryCode]} {COUNTRY_LABELS_JA[item.countryCode]}
                  </span>
                  <Badge variant={item.source === 'local' ? 'local' : 'live'}>
                    {item.source === 'local' ? 'LOCAL' : 'LIVE'}
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-400">
                  {COURSE_LABELS_JA[item.courseSlug]} · {formatRelativeJa(item.createdAt)}
                </span>
                <span className="line-clamp-1 text-[11px] text-slate-500 group-hover:text-slate-300">
                  “{item.promptText}”
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </aside>
  );
}
