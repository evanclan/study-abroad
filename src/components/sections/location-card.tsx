'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell } from '@/components/sections/section-shell';
import { formatJpy } from '@/lib/utils/format-currency';
import type { LocationIntel } from '@/types/quote';
import {
  CloudSun,
  Compass,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sun,
  Train,
  Wallet,
  Waves,
} from 'lucide-react';

interface LocationCardProps {
  location: LocationIntel | null;
  loading: boolean;
}

interface Row {
  icon: React.ReactNode;
  label: string;
  value?: string;
}

export function LocationCard({ location, loading }: LocationCardProps) {
  if (loading && !location) {
    return (
      <SectionShell title="Location Intel" subtitle="街の情報" accent="sky">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px]" />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (!location) {
    return (
      <SectionShell title="Location Intel" subtitle="街の情報" accent="sky">
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          ロケーション情報が取得できませんでした。
        </p>
      </SectionShell>
    );
  }

  const rows: Row[] = [
    { icon: <Sparkles className="h-4 w-4" />, label: '雰囲気', value: location.vibe },
    { icon: <CloudSun className="h-4 w-4" />, label: '気候', value: location.climateNote },
    { icon: <Sun className="h-4 w-4" />, label: 'ベストシーズン', value: location.bestSeasonNote },
    { icon: <Waves className="h-4 w-4" />, label: 'ビーチアクセス', value: location.beachAccess },
    { icon: <Train className="h-4 w-4" />, label: '交通', value: location.transitNote },
    { icon: <ShieldCheck className="h-4 w-4" />, label: '治安', value: location.safetyNote },
    {
      icon: <Wallet className="h-4 w-4" />,
      label: '1日生活費目安',
      value: location.averageDailyBudgetJpy
        ? formatJpy(location.averageDailyBudgetJpy)
        : undefined,
    },
    { icon: <Compass className="h-4 w-4" />, label: 'タイムゾーン', value: location.timezone },
  ].filter((r) => r.value);

  return (
    <SectionShell
      title="Location Intel"
      subtitle={`${location.city}, ${location.country}`}
      accent="sky"
      trailing={
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <MapPin className="h-3 w-3" />
          {location.city}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-400/20">
              {row.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {row.label}
              </div>
              <div className="text-sm leading-snug text-slate-100">{row.value}</div>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
