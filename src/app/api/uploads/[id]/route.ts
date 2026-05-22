import { createSignedDocumentUrl } from '@/lib/uploads/storage';
import { getServerSupabase } from '@/lib/supabase/local-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: doc, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!doc) return jsonError('Document not found.', 404);

  let signedUrl = doc.storage_signed_url;
  if (!signedUrl) signedUrl = await createSignedDocumentUrl(doc.storage_path);

  const { data: entities } = await supabase
    .from('extracted_entities')
    .select('*')
    .eq('document_id', id)
    .order('entity_type', { ascending: true });

  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('id, chunk_index, content, token_estimate, page_number')
    .eq('document_id', id)
    .order('chunk_index', { ascending: true })
    .limit(40);

  return Response.json({
    document: { ...doc, storage_signed_url: signedUrl },
    entities: entities ?? [],
    chunks: chunks ?? [],
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: doc } = await supabase
    .from('document_uploads')
    .select('storage_path, storage_bucket')
    .eq('id', id)
    .maybeSingle();

  if (doc?.storage_path) {
    await supabase.storage
      .from(doc.storage_bucket || 'documents')
      .remove([doc.storage_path]);
  }

  const { error } = await supabase.from('document_uploads').delete().eq('id', id);
  if (error) return jsonError(error.message, 500);

  return Response.json({ ok: true });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
