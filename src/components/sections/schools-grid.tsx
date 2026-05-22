'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell } from '@/components/sections/section-shell';
import { formatSourceCurrency } from '@/lib/utils/format-currency';
import type { SchoolCard } from '@/types/quote';
import { ExternalLink, GraduationCap, MapPin, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface SchoolsGridProps {
  schools: SchoolCard[];
  loading: boolean;
}

export function SchoolsGrid({ schools, loading }: SchoolsGridProps) {
  return (
    <SectionShell
      title="Schools Catalogue"
      subtitle="候補校リサーチ"
      accent="violet"
      trailing={
        schools.length > 0 ? (
          <Badge variant="accent">{schools.length}校</Badge>
        ) : null
      }
    >
      {loading && schools.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[160px]" />
          ))}
        </div>
      ) : schools.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          条件に合う学校が見つかりませんでした。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((school, i) => (
            <motion.a
              key={`${school.url}-${i}`}
              href={school.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white">
                    {school.name}
                  </h3>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-white" />
              </div>

              {school.location ? (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" />
                  {school.location}
                  {typeof school.distanceToBeachKm === 'number' ? (
                    <span className="ml-1 text-emerald-300">
                      · ビーチまで {school.distanceToBeachKm}km
                    </span>
                  ) : null}
                </div>
              ) : null}

              {school.description ? (
                <p className="line-clamp-2 text-xs text-slate-400">{school.description}</p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                {school.weeklyTuition ? (
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                    週 {formatSourceCurrency(school.weeklyTuition, school.currencyCode ?? 'AUD')}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">価格は要確認</span>
                )}
                {school.totalEstimate ? (
                  <span className="text-[11px] text-slate-300">
                    総額目安 {formatSourceCurrency(school.totalEstimate, school.currencyCode ?? 'AUD')}
                  </span>
                ) : null}
              </div>

              {school.highlights.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {school.highlights.slice(0, 4).map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-violet-300" />
                      {h}
                    </span>
                  ))}
                </div>
              ) : null}
            </motion.a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
