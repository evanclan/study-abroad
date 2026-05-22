'use client';

import { AiMatchmaker } from '@/components/columns/ai-matchmaker';
import { DataProvenance } from '@/components/columns/data-provenance';
import { FinancialBlueprint } from '@/components/columns/financial-blueprint';
import { ProfileMatrix } from '@/components/columns/profile-matrix';
import { Badge } from '@/components/ui/badge';
import { PulsingDot } from '@/components/ui/pulsing-dot';
import { cn } from '@/lib/utils/cn';
import type { QuoteState } from '@/hooks/use-quote-stream';
import type { StreamPhase } from '@/types/quote';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface DashboardBoardProps {
  state: QuoteState;
}

const PHASE_LABELS: Record<StreamPhase, string> = {
  parsing: 'プロンプト解析',
  cache_lookup: 'キャッシュ照会',
  knowledge_lookup: 'ナレッジ検索',
  scraping: 'ライブ取得',
  research_schools: '学校リサーチ',
  research_accommodation: '宿泊リサーチ',
  research_location: '街情報リサーチ',
  research_activities: 'アクティビティ調査',
  extracting: '料金抽出',
  fx: '為替換算',
  budget: '予算判定',
  insights: 'AIアドバイス生成',
  persisting: 'キャッシュ保存',
  done: '完了',
};

export function DashboardBoard({ state }: DashboardBoardProps) {
  const isIdle = state.status === 'idle';
  const isStreaming = state.status === 'streaming';
  const insightStreaming = isStreaming && state.phase === 'insights';

  if (isIdle) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusBar state={state} />

      {state.error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
          <div>
            <div className="font-medium">エラー ({PHASE_LABELS[state.error.phase]})</div>
            <div className="text-rose-200/80">{state.error.message}</div>
          </div>
        </div>
      ) : null}

      <div className="relative -mx-2 overflow-x-auto px-2 pb-3">
        <div className="flex min-w-max gap-4">
          <ProfileMatrix params={state.params} prompt={state.prompt} />
          <DataProvenance
            source={state.source}
            sourceUrl={state.sourceUrl}
            schoolName={state.schoolName}
            cachedAt={state.cachedAt}
          />
          <FinancialBlueprint costs={state.costs} />
          <AiMatchmaker
            summary={state.insightSummary}
            suggestions={state.insightSuggestions}
            isStreaming={insightStreaming}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ state }: { state: QuoteState }) {
  const phaseLabel = state.phase ? PHASE_LABELS[state.phase] : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <PulsingDot color={state.status === 'streaming' ? 'sky' : state.status === 'error' ? 'rose' : 'emerald'} />
        <span className="font-medium text-white">
          {state.status === 'streaming' ? '処理中' : state.status === 'done' ? '完了' : state.status === 'error' ? 'エラー' : '待機中'}
        </span>
      </div>
      {phaseLabel ? (
        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300">
          {phaseLabel}
          {state.phaseMessage ? ` · ${state.phaseMessage}` : ''}
        </span>
      ) : null}
      {state.source ? (
        <Badge variant={state.source === 'local' ? 'local' : 'live'}>
          {state.source === 'local' ? 'LOCAL CACHE' : 'LIVE SEARCH'}
        </Badge>
      ) : null}
      <div className="ml-auto flex items-center gap-1 text-slate-400">
        <Sparkles className="h-3.5 w-3.5" />
        Powered by Claude sonnet-4-5
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'relative grid place-items-center rounded-3xl border border-dashed border-white/10',
          'bg-gradient-to-b from-white/[0.02] to-transparent px-6 py-16 text-center',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 ring-1 ring-inset ring-violet-300/30">
          <Sparkles className="h-6 w-6 text-violet-100" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">
          自然言語で見積もりを生成
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          国・年齢・コース・期間を含む短い文を入力するだけで、ローカルキャッシュまたは
          ライブ検索から最新の費用と日本語のカウンセラー向けアドバイスを取得します。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <Badge variant="local">LOCAL ≤ 30日</Badge>
          <Badge variant="live">LIVE Firecrawl</Badge>
          <Badge variant="accent">AI Claude</Badge>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
