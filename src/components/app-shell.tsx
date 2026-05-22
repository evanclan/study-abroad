'use client';

import { useState } from 'react';

import { QuoteWorkspace } from '@/components/quote-workspace';
import { UploadHub } from '@/components/upload-hub';
import { cn } from '@/lib/utils/cn';
import { Database, MessageSquareText, UploadCloud } from 'lucide-react';

type Tab = 'quote' | 'upload';

const TABS: Array<{ id: Tab; label: string; sub: string; icon: typeof Database }> = [
  {
    id: 'quote',
    label: 'Quote Engine',
    sub: '見積もりプロンプト',
    icon: MessageSquareText,
  },
  {
    id: 'upload',
    label: 'Upload Hub',
    sub: 'ナレッジ取り込み',
    icon: UploadCloud,
  },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>('quote');

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-1.5 backdrop-blur-xl sm:gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'group flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition sm:px-4 sm:py-2.5',
                active
                  ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-white ring-1 ring-inset ring-violet-400/30 shadow-[0_8px_30px_-12px_rgba(139,92,246,0.6)]'
                  : 'text-slate-400 hover:bg-white/[0.03] hover:text-white',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition',
                  active ? 'text-violet-200' : 'text-slate-400 group-hover:text-white',
                )}
              />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[13px] font-medium">{t.label}</span>
                <span className="hidden text-[10px] text-slate-400 sm:block">
                  {t.sub}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {tab === 'quote' ? <QuoteWorkspace /> : <UploadHub />}
    </div>
  );
}
