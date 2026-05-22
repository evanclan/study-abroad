'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell } from '@/components/sections/section-shell';
import { formatSourceCurrency } from '@/lib/utils/format-currency';
import type { AccommodationKind, AccommodationOption } from '@/types/quote';
import {
  Building2,
  ExternalLink,
  Home,
  Hotel,
  MapPin,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';

const KIND_LABEL: Record<AccommodationKind, string> = {
  apartment: 'アパート',
  share_house: 'シェアハウス',
  dorm: 'ドーミトリー',
  homestay: 'ホームステイ',
  hotel: 'ホテル',
  guesthouse: 'ゲストハウス',
  other: 'その他',
};

const KIND_ICON: Record<AccommodationKind, React.ReactNode> = {
  apartment: <Building2 className="h-4 w-4" />,
  share_house: <Users className="h-4 w-4" />,
  dorm: <Users className="h-4 w-4" />,
  homestay: <Home className="h-4 w-4" />,
  hotel: <Hotel className="h-4 w-4" />,
  guesthouse: <Hotel className="h-4 w-4" />,
  other: <Home className="h-4 w-4" />,
};

interface AccommodationGridProps {
  accommodations: AccommodationOption[];
  loading: boolean;
}

function priceLabel(a: AccommodationOption): string | null {
  const ccy = a.currencyCode ?? 'JPY';
  if (a.pricePerNight) return `${formatSourceCurrency(a.pricePerNight, ccy)} / 泊`;
  if (a.pricePerWeek) return `${formatSourceCurrency(a.pricePerWeek, ccy)} / 週`;
  if (a.pricePerMonth) return `${formatSourceCurrency(a.pricePerMonth, ccy)} / 月`;
  return null;
}

export function AccommodationGrid({ accommodations, loading }: AccommodationGridProps) {
  return (
    <SectionShell
      title="Accommodation Lab"
      subtitle="宿泊候補（ビーチ・予算考慮）"
      accent="emerald"
      trailing={
        accommodations.length > 0 ? (
          <Badge variant="local">{accommodations.length}件</Badge>
        ) : null
      }
    >
      {loading && accommodations.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      ) : accommodations.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          条件に合う宿泊先が見つかりませんでした。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accommodations.map((a, i) => {
            const price = priceLabel(a);
            const Inner = (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-300">{KIND_ICON[a.kind]}</span>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                        {KIND_LABEL[a.kind]}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white">
                        {a.name}
                      </h3>
                    </div>
                  </div>
                  {a.url ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-white" /> : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  {a.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {a.location}
                    </span>
                  ) : null}
                  {typeof a.distanceToBeachKm === 'number' ? (
                    <span className="text-emerald-300">ビーチ {a.distanceToBeachKm}km</span>
                  ) : null}
                  {typeof a.distanceToSchoolKm === 'number' ? (
                    <span className="text-violet-300">学校 {a.distanceToSchoolKm}km</span>
                  ) : null}
                  {typeof a.rating === 'number' ? (
                    <span className="inline-flex items-center gap-0.5 text-amber-300">
                      <Star className="h-3 w-3 fill-current" />
                      {a.rating.toFixed(1)}
                    </span>
                  ) : null}
                </div>

                {price ? (
                  <div className="text-sm font-semibold text-emerald-200">{price}</div>
                ) : (
                  <div className="text-xs text-slate-500">価格は要確認</div>
                )}

                {a.highlights.length > 0 ? (
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {a.highlights.slice(0, 4).map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        <Sparkles className="h-2.5 w-2.5 text-emerald-300" />
                        {h}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            );

            return a.url ? (
              <a
                key={`${a.name}-${i}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                {Inner}
              </a>
            ) : (
              <div key={`${a.name}-${i}`} className="h-full">
                {Inner}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
