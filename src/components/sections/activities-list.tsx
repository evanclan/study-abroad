'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell } from '@/components/sections/section-shell';
import { formatJpy } from '@/lib/utils/format-currency';
import type { ActivityItem } from '@/types/quote';
import {
  Calendar,
  ExternalLink,
  Music,
  Mountain,
  Sparkles,
  Sun,
  Sailboat,
  ShoppingBag,
  UtensilsCrossed,
  Waves,
} from 'lucide-react';
import { motion } from 'motion/react';

interface ActivitiesListProps {
  activities: ActivityItem[];
  loading: boolean;
}

const CATEGORY_LABEL: Record<ActivityItem['category'], string> = {
  event: 'イベント',
  beach: 'ビーチ',
  food: 'グルメ',
  culture: '文化',
  nightlife: 'ナイトライフ',
  nature: '自然',
  shopping: 'ショッピング',
  other: 'その他',
};

const CATEGORY_ICON: Record<ActivityItem['category'], React.ReactNode> = {
  event: <Calendar className="h-4 w-4" />,
  beach: <Waves className="h-4 w-4" />,
  food: <UtensilsCrossed className="h-4 w-4" />,
  culture: <Sparkles className="h-4 w-4" />,
  nightlife: <Music className="h-4 w-4" />,
  nature: <Mountain className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
  other: <Sun className="h-4 w-4" />,
};

const CATEGORY_ACCENT: Record<ActivityItem['category'], string> = {
  event: 'text-violet-300 bg-violet-500/10',
  beach: 'text-sky-300 bg-sky-500/10',
  food: 'text-amber-300 bg-amber-500/10',
  culture: 'text-fuchsia-300 bg-fuchsia-500/10',
  nightlife: 'text-rose-300 bg-rose-500/10',
  nature: 'text-emerald-300 bg-emerald-500/10',
  shopping: 'text-pink-300 bg-pink-500/10',
  other: 'text-slate-300 bg-white/[0.04]',
};

export function ActivitiesList({ activities, loading }: ActivitiesListProps) {
  return (
    <SectionShell
      title="Lifestyle & Activities"
      subtitle="留学中の余暇プラン"
      accent="amber"
      trailing={<Sailboat className="h-4 w-4 text-amber-300" />}
    >
      {loading && activities.length === 0 ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          アクティビティ候補がまだありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {activities.map((a, i) => {
            const inner = (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.03 }}
                className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${CATEGORY_ACCENT[a.category]}`}>
                  {CATEGORY_ICON[a.category]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {CATEGORY_LABEL[a.category]}
                      {a.whenLabel ? ` · ${a.whenLabel}` : ''}
                    </div>
                    {a.url ? <ExternalLink className="h-3 w-3 shrink-0 text-slate-500 group-hover:text-white" /> : null}
                  </div>
                  <div className="text-sm font-medium text-slate-100 group-hover:text-white">{a.title}</div>
                  {a.description ? (
                    <p className="line-clamp-2 text-xs text-slate-400">{a.description}</p>
                  ) : null}
                  {a.priceJpy ? (
                    <div className="mt-1 text-[11px] font-medium text-amber-200">
                      目安 {formatJpy(a.priceJpy)}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
            return a.url ? (
              <a key={`${a.title}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              <div key={`${a.title}-${i}`}>{inner}</div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
