'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecentQuote } from '@/types/quote';

interface UseRecentQuotesResult {
  items: RecentQuote[];
  loading: boolean;
  refresh: () => void;
}

export function useRecentQuotes(refreshKey: unknown): UseRecentQuotesResult {
  const [items, setItems] = useState<RecentQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      if (!res.ok) throw new Error(`History failed (${res.status})`);
      const json = (await res.json()) as { items?: RecentQuote[] };
      setItems(json.items ?? []);
    } catch {
      // Silently degrade – the rail is non-critical.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { items, loading, refresh };
}
