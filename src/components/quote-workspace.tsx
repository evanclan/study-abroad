'use client';

import { DashboardBoard } from '@/components/dashboard-board';
import { QuoteInput } from '@/components/quote-input';
import { RecentQuotesRail } from '@/components/recent-quotes-rail';
import { AccommodationGrid } from '@/components/sections/accommodation-grid';
import { ActivitiesList } from '@/components/sections/activities-list';
import { BudgetMeter } from '@/components/sections/budget-meter';
import { KnowledgeMatchesPanel } from '@/components/sections/knowledge-matches-panel';
import { LocationCard } from '@/components/sections/location-card';
import { ReferencesPanel } from '@/components/sections/references-panel';
import { SchoolsGrid } from '@/components/sections/schools-grid';
import { useQuoteStream } from '@/hooks/use-quote-stream';
import { useCallback, useEffect, useState } from 'react';

export function QuoteWorkspace() {
  const { state, submit } = useQuoteStream();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = useCallback(
    (prompt: string) => {
      void submit(prompt);
    },
    [submit],
  );

  useEffect(() => {
    if (state.status === 'done' || state.status === 'error') {
      setRefreshKey((k) => k + 1);
    }
  }, [state.status]);

  const showSections = state.status !== 'idle';
  const isStreaming = state.status === 'streaming';

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <section className="flex flex-1 flex-col gap-6">
        <QuoteInput onSubmit={handleSubmit} disabled={isStreaming} />
        <DashboardBoard state={state} />

        {showSections ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className="lg:col-span-2 xl:col-span-3">
              <KnowledgeMatchesPanel
                knowledge={state.knowledge}
                loading={isStreaming}
              />
            </div>
            <div className="lg:col-span-2 xl:col-span-3">
              <SchoolsGrid schools={state.schools} loading={isStreaming} />
            </div>
            <div className="lg:col-span-2 xl:col-span-2">
              <AccommodationGrid accommodations={state.accommodations} loading={isStreaming} />
            </div>
            <div className="lg:col-span-2 xl:col-span-1">
              <BudgetMeter budget={state.budget} />
            </div>
            <div className="lg:col-span-1 xl:col-span-2">
              <LocationCard location={state.location} loading={isStreaming} />
            </div>
            <div className="lg:col-span-1 xl:col-span-1">
              <ActivitiesList activities={state.activities} loading={isStreaming} />
            </div>
            <div className="lg:col-span-2 xl:col-span-3">
              <ReferencesPanel references={state.references} loading={isStreaming} />
            </div>
          </div>
        ) : null}
      </section>
      <RecentQuotesRail refreshKey={refreshKey} onPick={handleSubmit} />
    </div>
  );
}
