import { ingestUpload } from '@/lib/uploads/ingest';
import { createSignedDocumentUrl } from '@/lib/uploads/storage';
import { getServerSupabase } from '@/lib/supabase/local-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // up to 5 minutes for big AI analyses

const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument',
  'application/msword',
  'application/vnd.ms-excel',
  'text/',
  'image/',
  'application/json',
];

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function isAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Multipart form-data is required.', 400);
  }

  const files = form.getAll('files').filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    const single = form.get('file');
    if (single instanceof File) files.push(single);
  }

  if (files.length === 0) {
    return jsonError('No files were uploaded. Use the "files" field.', 400);
  }

  const title = stringOrNull(form.get('title'));
  const description = stringOrNull(form.get('description'));
  const sourceLabel = stringOrNull(form.get('sourceLabel'));
  const tagsRaw = stringOrNull(form.get('tags'));
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const results: Array<{
    filename: string;
    ok: boolean;
    documentId?: string;
    entities?: number;
    warnings?: string[];
    error?: string;
    reused?: boolean;
  }> = [];

  for (const file of files) {
    if (file.size === 0) {
      results.push({ filename: file.name, ok: false, error: 'File is empty.' });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      results.push({
        filename: file.name,
        ok: false,
        error: `File too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB).`,
      });
      continue;
    }
    if (!isAllowed(file.type)) {
      results.push({
        filename: file.name,
        ok: false,
        error: `Unsupported MIME type: ${file.type}`,
      });
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ingested = await ingestUpload({
        filename: file.name,
        mimeType: file.type,
        bytes,
        title: title ?? undefined,
        description: description ?? undefined,
        sourceLabel: sourceLabel ?? undefined,
        tags,
      });
      results.push({
        filename: file.name,
        ok: true,
        documentId: ingested.document.id,
        entities: ingested.entitiesCreated,
        warnings: ingested.warnings,
        reused: ingested.reused,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ filename: file.name, ok: false, error: message });
    }
  }

  return Response.json({ results });
}

/**
 * GET /api/uploads
 * List the recent uploads + their analysis status. Used by the Upload Hub UI.
 */
export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  const { data, error } = await supabase
    .from('document_uploads')
    .select(
      [
        'id',
        'filename',
        'mime_type',
        'file_size_bytes',
        'storage_path',
        'storage_signed_url',
        'title',
        'description',
        'source_label',
        'tags',
        'country_codes',
        'course_slugs',
        'school_name',
        'city_or_region',
        'currency_code',
        'valid_from',
        'valid_to',
        'extracted_summary_ja',
        'ai_keywords',
        'ai_confidence',
        'status',
        'error_message',
        'uploaded_at',
        'processed_at',
        'updated_at',
      ].join(','),
    )
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error) {
    return jsonError(error.message, 500);
  }

  // Refresh signed URLs that may have expired.
  type DocRow = Record<string, unknown> & {
    id: string;
    storage_path: string;
    storage_signed_url: string | null;
  };
  const rows = (data ?? []) as unknown as DocRow[];

  const docs = await Promise.all(
    rows.map(async (row) => {
      if (row.storage_signed_url) return row;
      const signedUrl = await createSignedDocumentUrl(row.storage_path);
      return { ...row, storage_signed_url: signedUrl };
    }),
  );

  return Response.json({ documents: docs });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
