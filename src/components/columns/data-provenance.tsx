import { Badge } from '@/components/ui/badge';
import { ColumnShell } from '@/components/ui/column-shell';
import { PulsingDot } from '@/components/ui/pulsing-dot';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeJa } from '@/lib/utils/format-currency';
import type { QuoteSource } from '@/types/quote';
import { CheckCircle2, ExternalLink, Radio, ShieldCheck } from 'lucide-react';

interface DataProvenanceProps {
  source: QuoteSource | null;
  sourceUrl: string | null;
  schoolName: string | null;
  cachedAt: string | null;
}

function tryDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function DataProvenance({
  source,
  sourceUrl,
  schoolName,
  cachedAt,
}: DataProvenanceProps) {
  const domain = tryDomain(sourceUrl);
  const isLocal = source === 'local';
  const isLive = source === 'live_search';

  return (
    <ColumnShell
      title="Data Provenance"
      subtitle="情報源"
      index={1}
      accent={isLocal ? 'emerald' : 'sky'}
      trailing={
        source ? (
          <Badge variant={isLocal ? 'local' : 'live'}>
            {isLocal ? <ShieldCheck className="h-3 w-3" /> : <PulsingDot color="sky" />}
            {isLocal ? 'CACHED' : 'LIVE'}
          </Badge>
        ) : null
      }
    >
      {!source ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[80px]" />
          <Skeleton className="h-[40px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={
              isLocal
                ? 'rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4'
                : 'rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4'
            }
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-300">
              {isLocal ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Radio className="h-4 w-4 text-sky-300" />
              )}
              {isLocal ? 'ローカルキャッシュ' : 'ライブスクレイピング'}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              {isLocal
                ? '直近30日以内に取得した検証済みデータを返しています。'
                : 'リアルタイムで対象校のページを取得し、最新の料金を抽出しました。'}
            </p>
            {cachedAt ? (
              <p className="mt-1 text-[11px] text-slate-400">
                {isLocal ? '取得' : '更新'}: {formatRelativeJa(cachedAt)}
              </p>
            ) : null}
          </div>

          {schoolName ? (
            <div className="rounded-xl bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                対象校
              </div>
              <div className="mt-1 text-sm font-medium text-slate-100">
                {schoolName}
              </div>
            </div>
          ) : null}

          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              {domain ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt=""
                  className="h-6 w-6 rounded"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  ソースURL
                </div>
                <div className="truncate text-sm text-slate-200 group-hover:text-white">
                  {domain ?? sourceUrl}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-white" />
            </a>
          ) : isLive ? (
            <Skeleton className="h-[60px]" />
          ) : null}
        </div>
      )}
    </ColumnShell>
  );
}
