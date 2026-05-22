'use client';

import { SectionShell } from '@/components/sections/section-shell';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type {
  KnowledgeEntityType,
  KnowledgeLookup,
  KnowledgeMatch,
} from '@/types/quote';
import {
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Sparkles,
} from 'lucide-react';

interface KnowledgeMatchesPanelProps {
  knowledge: KnowledgeLookup | null;
  loading: boolean;
}

const ENTITY_LABEL: Record<KnowledgeEntityType, string> = {
  school: '学校',
  price: '価格',
  campaign: 'キャンペーン',
  accommodation: '宿泊',
  activity: 'アクティビティ',
  location: '街情報',
  rule: 'ルール',
  contact: '連絡先',
  program: 'プログラム',
  visa: 'ビザ',
  insurance: '保険',
  flight: '航空券',
  note: 'メモ',
  other: 'その他',
};

const ENTITY_BG: Record<KnowledgeEntityType, string> = {
  school: 'bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-400/30',
  price: 'bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/30',
  campaign: 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/30',
  accommodation:
    'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30',
  activity: 'bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-400/30',
  location: 'bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-400/30',
  rule: 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-inset ring-fuchsia-400/30',
  contact: 'bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/30',
  program: 'bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-400/30',
  visa: 'bg-orange-500/15 text-orange-200 ring-1 ring-inset ring-orange-400/30',
  insurance:
    'bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-400/30',
  flight: 'bg-pink-500/15 text-pink-200 ring-1 ring-inset ring-pink-400/30',
  note: 'bg-white/[0.04] text-slate-200 ring-1 ring-inset ring-white/10',
  other: 'bg-white/[0.04] text-slate-200 ring-1 ring-inset ring-white/10',
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return FileSpreadsheet;
  if (mimeType === 'application/pdf') return FileType;
  return FileText;
}

function formatPrice(m: KnowledgeMatch): string | null {
  if (m.amount == null) return null;
  const unit =
    m.amountUnit === 'per_week'
      ? '/週'
      : m.amountUnit === 'per_month'
      ? '/月'
      : m.amountUnit === 'per_night'
      ? '/泊'
      : m.amountUnit === 'per_year'
      ? '/年'
      : m.amountUnit === 'one_time'
      ? '(1回)'
      : '';
  return `${m.currencyCode ?? ''} ${m.amount.toLocaleString()}${unit}`;
}

function formatValidity(m: KnowledgeMatch): string | null {
  if (!m.validFrom && !m.validTo) return null;
  return `${m.validFrom ?? '?'} 〜 ${m.validTo ?? '?'}`;
}

export function KnowledgeMatchesPanel({
  knowledge,
  loading,
}: KnowledgeMatchesPanelProps) {
  const matches = knowledge?.matches ?? [];
  const sufficient = knowledge?.sufficient ?? false;

  return (
    <SectionShell
      title="Local Knowledge"
      subtitle="社内資料からの一致"
      accent="violet"
      trailing={
        <div className="flex items-center gap-2">
          {matches.length > 0 ? (
            <Badge variant={sufficient ? 'local' : 'accent'}>
              {sufficient ? '十分一致' : '部分一致'} · {matches.length}件
            </Badge>
          ) : null}
        </div>
      }
    >
      {loading && matches.length === 0 ? (
        <div className="grid gap-2">
          <div className="h-[60px] animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-[60px] animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400">
          {knowledge?.rationaleJa ??
            'まだアップロード済み資料に一致がありません。アップロードハブから PDF / Word / Excel / 画像をドロップしてください。'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {knowledge?.rationaleJa ? (
            <div className="flex items-start gap-2 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3 text-xs text-violet-100">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
              <p className="leading-relaxed">{knowledge.rationaleJa}</p>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {matches.slice(0, 8).map((m) => {
              const Icon = fileIcon(m.source.mimeType);
              const price = formatPrice(m);
              const validity = formatValidity(m);
              return (
                <li
                  key={m.entityId}
                  className="group rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                            ENTITY_BG[m.entityType],
                          )}
                        >
                          {ENTITY_LABEL[m.entityType]}
                        </span>
                        {m.schoolName ? (
                          <span className="text-[11px] text-slate-300">
                            {m.schoolName}
                          </span>
                        ) : null}
                        {m.cityOrRegion ? (
                          <span className="text-[11px] text-slate-400">
                            · {m.cityOrRegion}
                          </span>
                        ) : null}
                        <span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                          score {m.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-medium text-white">
                        {m.title}
                      </div>
                      {m.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                          {m.summary}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {price ? (
                          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-rose-200">
                            {price}
                          </span>
                        ) : null}
                        {validity ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200">
                            {validity}
                          </span>
                        ) : null}
                        {m.countryCode ? (
                          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300">
                            {m.countryCode}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2 text-[11px]">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-300">
                      {m.source.title ?? m.source.filename}
                    </span>
                    {m.source.sourceLabel ? (
                      <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-400">
                        {m.source.sourceLabel}
                      </span>
                    ) : null}
                    {m.source.signedUrl ? (
                      <a
                        href={m.source.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
                      >
                        原資料を開く
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionShell>
  );
}
