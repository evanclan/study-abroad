import { createHash } from 'node:crypto';

import { getServerSupabase } from '@/lib/supabase/local-client';

const DOCUMENTS_BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function buildStoragePath(opts: {
  contentHash: string;
  filename: string;
}): string {
  const safeName = opts.filename.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const date = new Date().toISOString().slice(0, 10);
  return `${date}/${opts.contentHash}-${safeName}`;
}

export async function uploadToDocumentsBucket(opts: {
  storagePath: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(opts.storagePath, opts.bytes, {
      contentType: opts.contentType,
      upsert: true,
    });
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
}

export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.warn('[storage] signed url error', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export const BUCKETS = { documents: DOCUMENTS_BUCKET } as const;
