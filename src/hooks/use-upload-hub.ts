'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Database } from '@/lib/supabase/database.types';

export type DocumentRow = Database['public']['Tables']['document_uploads']['Row'];

export interface UploadProgress {
  id: string;
  filename: string;
  status:
    | 'queued'
    | 'uploading'
    | 'processing'
    | 'analyzed'
    | 'failed'
    | 'reused';
  error?: string;
  entities?: number;
  warnings?: string[];
  documentId?: string;
}

export interface UseUploadHubReturn {
  documents: DocumentRow[];
  uploads: UploadProgress[];
  loadingDocuments: boolean;
  errorMessage: string | null;
  upload: (files: File[], meta?: UploadMeta) => Promise<void>;
  refresh: () => Promise<void>;
  remove: (documentId: string) => Promise<void>;
}

export interface UploadMeta {
  title?: string;
  description?: string;
  sourceLabel?: string;
  tags?: string;
}

export function useUploadHub(): UseUploadHubReturn {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const response = await fetch('/api/uploads', { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load uploads (${response.status}).`);
      }
      const json = (await response.json()) as { documents: DocumentRow[] };
      setDocuments(json.documents ?? []);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: File[], meta: UploadMeta = {}) => {
      if (files.length === 0) return;
      const queued: UploadProgress[] = files.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        filename: f.name,
        status: 'queued',
      }));
      setUploads((prev) => [...queued, ...prev].slice(0, 20));

      // Mark uploading
      setUploads((prev) =>
        prev.map((u) =>
          queued.some((q) => q.id === u.id) ? { ...u, status: 'uploading' } : u,
        ),
      );

      const form = new FormData();
      for (const f of files) form.append('files', f);
      if (meta.title) form.append('title', meta.title);
      if (meta.description) form.append('description', meta.description);
      if (meta.sourceLabel) form.append('sourceLabel', meta.sourceLabel);
      if (meta.tags) form.append('tags', meta.tags);

      try {
        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: form,
        });
        const json = (await response.json()) as {
          results: Array<{
            filename: string;
            ok: boolean;
            documentId?: string;
            entities?: number;
            warnings?: string[];
            error?: string;
            reused?: boolean;
          }>;
        };

        setUploads((prev) =>
          prev.map((u) => {
            const match = json.results.find((r) => r.filename === u.filename);
            if (!match) return u;
            if (!match.ok) {
              return { ...u, status: 'failed', error: match.error };
            }
            return {
              ...u,
              status: match.reused ? 'reused' : 'analyzed',
              entities: match.entities,
              warnings: match.warnings,
              documentId: match.documentId,
            };
          }),
        );

        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setUploads((prev) =>
          prev.map((u) =>
            queued.some((q) => q.id === u.id)
              ? { ...u, status: 'failed', error: message }
              : u,
          ),
        );
        setErrorMessage(message);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (documentId: string) => {
      const response = await fetch(`/api/uploads/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const text = await response.text();
        setErrorMessage(text || 'ファイルの削除に失敗しました。');
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    },
    [],
  );

  return {
    documents,
    uploads,
    loadingDocuments,
    errorMessage,
    upload,
    refresh,
    remove,
  };
}
