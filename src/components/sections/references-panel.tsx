'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { SectionShell } from '@/components/sections/section-shell';
import type { ReferenceSource } from '@/types/quote';
import { ExternalLink } from 'lucide-react';

interface ReferencesPanelProps {
  references: ReferenceSource[];
  loading: boolean;
}

const CATEGORY_LABEL: Record<ReferenceSource['category'], string> = {
  school: '学校',
  accommodation: '宿泊',
  location: '街情報',
  activity: 'アクティビティ',
  cost: '料金',
  document: '社内資料',
  other: 'その他',
};

const CATEGORY_BG: Record<ReferenceSource['category'], string> = {
  school: 'bg-violet-500/10 text-violet-300',
  accommodation: 'bg-emerald-500/10 text-emerald-300',
  location: 'bg-sky-500/10 text-sky-300',
  activity: 'bg-amber-500/10 text-amber-300',
  cost: 'bg-rose-500/10 text-rose-300',
  document: 'bg-fuchsia-500/10 text-fuchsia-300',
  other: 'bg-white/[0.04] text-slate-300',
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ReferencesPanel({ references, loading }: ReferencesPanelProps) {
  return (
    <SectionShell
      title="All Sources"
      subtitle="参考リンク"
      accent="slate"
      trailing={
        references.length > 0 ? (
          <span className="text-[11px] text-slate-400">{references.length}件</span>
        ) : null
      }
    >
      {loading && references.length === 0 ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px]" />
          ))}
        </div>
      ) : references.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] p-3 text-xs text-slate-500">
          参考リンクがまだありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {references.map((r) => {
            const domain = domainOf(r.url);
            return (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:border-white/15 hover:bg-white/[0.06]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${CATEGORY_BG[r.category]}`}>
                      {CATEGORY_LABEL[r.category]}
                    </span>
                    <span className="truncate text-[11px] text-slate-400">{domain}</span>
                  </div>
                  <div className="truncate text-xs text-slate-200 group-hover:text-white">
                    {r.title ?? r.url}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-white" />
              </a>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
