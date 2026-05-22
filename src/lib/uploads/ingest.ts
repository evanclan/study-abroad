import {
  analyzeDocument,
  type AnalyzedEntity,
} from '@/lib/uploads/analyze-document';
import {
  chunkText,
  extractTextFromUpload,
} from '@/lib/uploads/extract-text';
import {
  buildStoragePath,
  createSignedDocumentUrl,
  hashBytes,
  uploadToDocumentsBucket,
} from '@/lib/uploads/storage';
import { getServerSupabase } from '@/lib/supabase/local-client';
import type { Database } from '@/lib/supabase/database.types';

export type DocumentUploadRow =
  Database['public']['Tables']['document_uploads']['Row'];

export interface IngestInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  title?: string;
  description?: string;
  sourceLabel?: string;
  tags?: string[];
  uploadedBy?: string;
}

export interface IngestResult {
  document: DocumentUploadRow;
  entitiesCreated: number;
  warnings: string[];
  reused: boolean;
}

/**
 * Full pipeline: dedup → upload to storage → extract text → AI analyze →
 * persist entities + chunks → mark analyzed. Idempotent on content_hash.
 */
export async function ingestUpload(input: IngestInput): Promise<IngestResult> {
  const supabase = getServerSupabase();
  const contentHash = hashBytes(input.bytes);

  // Dedup: if we already ingested this exact file, reuse the row.
  const { data: existing } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (existing && existing.status === 'analyzed') {
    return {
      document: existing,
      entitiesCreated: 0,
      warnings: ['同じ内容のファイルがすでにアップロード済みです。再利用しました。'],
      reused: true,
    };
  }

  // 1) Upload raw bytes to Supabase Storage.
  const storagePath = existing?.storage_path
    ?? buildStoragePath({ contentHash, filename: input.filename });

  if (!existing) {
    await uploadToDocumentsBucket({
      storagePath,
      contentType: input.mimeType || 'application/octet-stream',
      bytes: input.bytes,
    });
  }

  // 2) Create / move row to processing.
  const initialRow: Database['public']['Tables']['document_uploads']['Insert'] = {
    id: existing?.id,
    filename: input.filename,
    content_hash: contentHash,
    mime_type: input.mimeType || 'application/octet-stream',
    file_size_bytes: input.bytes.byteLength,
    storage_bucket: 'documents',
    storage_path: storagePath,
    title: input.title ?? null,
    description: input.description ?? null,
    source_label: input.sourceLabel ?? null,
    tags: input.tags ?? [],
    uploaded_by: input.uploadedBy ?? null,
    status: 'processing',
  };

  const { data: row, error: upsertErr } = await supabase
    .from('document_uploads')
    .upsert(initialRow, { onConflict: 'content_hash' })
    .select('*')
    .single();

  if (upsertErr || !row) {
    throw new Error(
      `Failed to persist document_uploads row: ${upsertErr?.message ?? 'unknown error'}`,
    );
  }

  // 3) Extract text from the file.
  let extractedText = '';
  const warnings: string[] = [];

  try {
    const extraction = await extractTextFromUpload({
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });
    extractedText = extraction.text;
    if (extraction.warnings.length) warnings.push(...extraction.warnings);

    await supabase
      .from('document_uploads')
      .update({
        extracted_text: extractedText,
        status: 'extracted',
      })
      .eq('id', row.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('document_uploads')
      .update({
        status: 'failed',
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    throw new Error(message);
  }

  // 4) AI analysis → structured entities.
  let analysis: Awaited<ReturnType<typeof analyzeDocument>> | null = null;
  try {
    analysis = await analyzeDocument({
      filename: input.filename,
      mimeType: input.mimeType,
      extractedText,
      sourceLabel: input.sourceLabel,
      description: input.description,
      tags: input.tags,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`AI解析に失敗しました: ${message}`);
    await supabase
      .from('document_uploads')
      .update({
        status: 'failed',
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    throw new Error(message);
  }

  // 5) Replace existing chunks + entities (idempotent re-ingest).
  await supabase.from('document_chunks').delete().eq('document_id', row.id);
  await supabase.from('extracted_entities').delete().eq('document_id', row.id);

  // 5a) Chunks
  const chunks = chunkText(extractedText);
  if (chunks.length > 0) {
    const chunkRows = chunks.map((content, idx) => ({
      document_id: row.id,
      chunk_index: idx,
      content,
      token_estimate: Math.ceil(content.length / 4),
    }));
    const { error: chunkErr } = await supabase.from('document_chunks').insert(chunkRows);
    if (chunkErr) warnings.push(`Chunk persistence failed: ${chunkErr.message}`);
  }

  // 5b) Entities
  let entitiesCreated = 0;
  if (analysis.entities.length > 0) {
    const entityRows = analysis.entities.map((e) => entityToRow(row.id, e));
    const { error: entErr } = await supabase
      .from('extracted_entities')
      .insert(entityRows);
    if (entErr) warnings.push(`Entity persistence failed: ${entErr.message}`);
    else entitiesCreated = entityRows.length;
  }

  // 5c) Best-effort: if the analyzer found schools, register them in `schools`.
  await registerSchoolsFromEntities(analysis.entities);

  // 6) Finalize document row.
  const signedUrl = await createSignedDocumentUrl(storagePath);
  const { data: finalRow } = await supabase
    .from('document_uploads')
    .update({
      extracted_summary_ja: analysis.summaryJa,
      ai_keywords: analysis.keywords,
      ai_confidence: analysis.confidence,
      country_codes: dedup(analysis.countryCodes),
      course_slugs: dedup(analysis.courseSlugs),
      school_name: analysis.schoolName ?? null,
      city_or_region: analysis.cityOrRegion ?? null,
      currency_code: analysis.currencyCode ?? null,
      valid_from: analysis.validFrom ?? null,
      valid_to: analysis.validTo ?? null,
      storage_signed_url: signedUrl,
      status: 'analyzed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select('*')
    .single();

  return {
    document: finalRow ?? row,
    entitiesCreated,
    warnings,
    reused: false,
  };
}

function entityToRow(
  documentId: string,
  e: AnalyzedEntity,
): Database['public']['Tables']['extracted_entities']['Insert'] {
  return {
    document_id: documentId,
    entity_type: e.entityType,
    title: e.title,
    summary: e.summary || null,
    body: e.body || null,
    country_code: e.countryCode ?? null,
    course_slug: e.courseSlug ?? null,
    school_name: e.schoolName ?? null,
    city_or_region: e.cityOrRegion ?? null,
    currency_code: e.currencyCode ?? null,
    amount: e.amount ?? null,
    amount_unit: e.amountUnit ?? null,
    duration_weeks: e.durationWeeks ?? null,
    age_bracket: e.ageBracket ?? null,
    valid_from: e.validFrom ?? null,
    valid_to: e.validTo ?? null,
    data: (e.data ?? {}) as Database['public']['Tables']['extracted_entities']['Insert']['data'],
    ai_confidence: e.confidence,
  };
}

async function registerSchoolsFromEntities(entities: AnalyzedEntity[]) {
  const supabase = getServerSupabase();
  const seen = new Set<string>();
  for (const e of entities) {
    if (e.entityType !== 'school') continue;
    if (!e.schoolName || !e.countryCode) continue;
    const key = `${e.countryCode}::${e.schoolName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await supabase
      .from('schools')
      .upsert(
        {
          country_code: e.countryCode,
          name: e.schoolName,
          source_url: typeof e.data?.url === 'string' ? (e.data.url as string) : null,
        },
        { onConflict: 'country_code,name' },
      );
  }
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
