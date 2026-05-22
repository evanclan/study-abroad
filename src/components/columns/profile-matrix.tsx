import { ColumnShell } from '@/components/ui/column-shell';
import { IconPill } from '@/components/ui/icon-pill';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COUNTRY_FLAGS,
  COUNTRY_LABELS_JA,
  COURSE_LABELS_JA,
} from '@/lib/quote/labels';
import { formatJpy } from '@/lib/utils/format-currency';
import type { QuoteParams } from '@/types/quote';
import {
  CalendarRange,
  GraduationCap,
  Globe2,
  Heart,
  MapPin,
  User,
  Wallet,
} from 'lucide-react';

interface ProfileMatrixProps {
  params: QuoteParams | null;
  prompt: string | null;
}

export function ProfileMatrix({ params, prompt }: ProfileMatrixProps) {
  return (
    <ColumnShell title="Profile Matrix" subtitle="検索条件" index={0} accent="violet">
      {prompt ? (
        <p className="rounded-xl bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
          “{prompt}”
        </p>
      ) : null}

      {!params ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <IconPill
            icon={<Globe2 className="h-4 w-4" />}
            label="留学先"
            value={`${COUNTRY_FLAGS[params.countryCode]} ${COUNTRY_LABELS_JA[params.countryCode]}`}
            accent="sky"
          />
          {params.cityOrRegion ? (
            <IconPill
              icon={<MapPin className="h-4 w-4" />}
              label="エリア"
              value={params.cityOrRegion}
              accent="sky"
            />
          ) : null}
          <IconPill
            icon={<User className="h-4 w-4" />}
            label="年齢"
            value={`${params.age}歳 (${params.ageBracket})`}
            accent="emerald"
          />
          <IconPill
            icon={<GraduationCap className="h-4 w-4" />}
            label="プログラム"
            value={COURSE_LABELS_JA[params.courseSlug]}
            accent="violet"
          />
          <IconPill
            icon={<CalendarRange className="h-4 w-4" />}
            label="期間"
            value={`${params.durationWeeks}週間 (約${params.durationMonths}ヶ月)`}
            accent="amber"
          />
          {params.budgetJpy ? (
            <IconPill
              icon={<Wallet className="h-4 w-4" />}
              label="ご予算"
              value={formatJpy(params.budgetJpy)}
              accent="amber"
            />
          ) : null}
          {params.schoolName ? (
            <IconPill
              icon={<GraduationCap className="h-4 w-4" />}
              label="学校指定"
              value={params.schoolName}
              accent="slate"
            />
          ) : null}
          {params.preferences.length > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-rose-300 ring-1 ring-inset ring-rose-400/30">
                <Heart className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  ご希望
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {params.preferences.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ColumnShell>
  );
}
