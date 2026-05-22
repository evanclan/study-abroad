-- Kaeru Knowledge Hub: vast local-first document & entity store.
--
-- Goal: every supplier PDF, image, spreadsheet, word doc, or note the
-- counselors upload becomes a citable, queryable knowledge atom.
-- The quote engine consults this layer FIRST (local), and only falls
-- back to live web scraping when the local knowledge is insufficient.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- =============================================================================
-- document_uploads: every raw file the counselors drop in the Upload Hub.
-- =============================================================================

create table if not exists document_uploads (
  id uuid primary key default gen_random_uuid (),

  -- Identity / dedup
  filename text not null,
  content_hash text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,

  -- Storage
  storage_bucket text not null default 'documents',
  storage_path text not null,
  storage_signed_url text,

  -- Free-form metadata supplied at upload time
  title text,
  description text,
  source_label text,                   -- e.g. supplier name / campaign
  tags text[] not null default '{}',

  -- Optional scope hints to help the matcher
  country_codes text[] not null default '{}',
  course_slugs text[] not null default '{}',
  school_name text,
  city_or_region text,
  currency_code text,

  -- Validity window (for campaigns / seasonal pricing)
  valid_from date,
  valid_to date,

  -- AI pipeline outputs
  extracted_text text,
  extracted_summary_ja text,
  ai_keywords text[] not null default '{}',
  ai_confidence numeric(3, 2),

  -- Lifecycle
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'extracted', 'analyzed', 'failed', 'archived')),
  error_message text,

  uploaded_by text,
  uploaded_at timestamptz not null default now (),
  processed_at timestamptz,
  updated_at timestamptz not null default now (),

  unique (content_hash)
);

create index if not exists document_uploads_status_idx
  on document_uploads (status, uploaded_at desc);

create index if not exists document_uploads_country_idx
  on document_uploads using gin (country_codes);

create index if not exists document_uploads_course_idx
  on document_uploads using gin (course_slugs);

create index if not exists document_uploads_tags_idx
  on document_uploads using gin (tags);

-- Trigram index on the full extracted text so the matcher can run fast fuzzy
-- LIKE / similarity queries against mixed-language (Japanese + English) content.
create index if not exists document_uploads_text_trgm_idx
  on document_uploads using gin (extracted_text gin_trgm_ops);

create index if not exists document_uploads_school_trgm_idx
  on document_uploads using gin (school_name gin_trgm_ops);

create index if not exists document_uploads_city_trgm_idx
  on document_uploads using gin (city_or_region gin_trgm_ops);

-- =============================================================================
-- document_chunks: paginated text chunks for chunk-level retrieval & display.
-- =============================================================================

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid (),
  document_id uuid not null references document_uploads (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_estimate int,
  page_number int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now (),

  unique (document_id, chunk_index)
);

create index if not exists document_chunks_doc_idx
  on document_chunks (document_id, chunk_index);

create index if not exists document_chunks_content_trgm_idx
  on document_chunks using gin (content gin_trgm_ops);

-- =============================================================================
-- extracted_entities: structured atoms extracted from each upload.
-- The matcher prefers these over raw text because they're typed & filterable.
-- =============================================================================

create table if not exists extracted_entities (
  id uuid primary key default gen_random_uuid (),
  document_id uuid not null references document_uploads (id) on delete cascade,

  entity_type text not null check (
    entity_type in (
      'school',
      'price',
      'campaign',
      'accommodation',
      'activity',
      'location',
      'rule',
      'contact',
      'program',
      'visa',
      'insurance',
      'flight',
      'note',
      'other'
    )
  ),

  title text not null,
  summary text,
  body text,                            -- normalized text representation

  -- Scope filters
  country_code text references countries (code) on delete set null,
  course_slug text references course_types (slug) on delete set null,
  school_name text,
  city_or_region text,

  -- Pricing (denormalized for fast budget matching)
  currency_code text,
  amount numeric(12, 2),
  amount_unit text,                     -- 'per_week' | 'per_month' | 'per_night' | 'total' | 'one_time' | ...
  duration_weeks int,
  age_bracket text,

  -- Validity
  valid_from date,
  valid_to date,

  data jsonb not null default '{}'::jsonb,
  ai_confidence numeric(3, 2),

  created_at timestamptz not null default now ()
);

create index if not exists extracted_entities_doc_idx
  on extracted_entities (document_id);

create index if not exists extracted_entities_type_country_idx
  on extracted_entities (entity_type, country_code, course_slug);

create index if not exists extracted_entities_school_trgm_idx
  on extracted_entities using gin (school_name gin_trgm_ops);

create index if not exists extracted_entities_city_trgm_idx
  on extracted_entities using gin (city_or_region gin_trgm_ops);

create index if not exists extracted_entities_body_trgm_idx
  on extracted_entities using gin (body gin_trgm_ops);

create index if not exists extracted_entities_data_idx
  on extracted_entities using gin (data);

-- =============================================================================
-- knowledge_search_log: track every prompt-vs-knowledge lookup for observability.
-- =============================================================================

create table if not exists knowledge_search_log (
  id uuid primary key default gen_random_uuid (),
  prompt_text text not null,
  parsed_params jsonb,
  match_count int not null default 0,
  top_match_id uuid references extracted_entities (id) on delete set null,
  used_in_response boolean not null default false,
  created_at timestamptz not null default now ()
);

create index if not exists knowledge_search_log_recent_idx
  on knowledge_search_log (created_at desc);

-- =============================================================================
-- updated_at triggers
-- =============================================================================

create or replace function set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_document_uploads_updated_at on document_uploads;
create trigger trg_document_uploads_updated_at
  before update on document_uploads
  for each row execute function set_updated_at ();

-- =============================================================================
-- Search RPC: SQL-side fuzzy search that returns ranked entities + their docs.
-- The orchestrator calls this BEFORE any web research.
-- =============================================================================

create or replace function search_knowledge (
  q text,
  p_country_code text default null,
  p_course_slug text default null,
  p_age_bracket text default null,
  p_school_name text default null,
  p_city text default null,
  p_limit int default 12
) returns table (
  entity_id uuid,
  document_id uuid,
  entity_type text,
  title text,
  summary text,
  body text,
  country_code text,
  course_slug text,
  school_name text,
  city_or_region text,
  currency_code text,
  amount numeric,
  amount_unit text,
  valid_from date,
  valid_to date,
  ai_confidence numeric,
  data jsonb,
  doc_filename text,
  doc_mime_type text,
  doc_storage_path text,
  doc_title text,
  doc_source_label text,
  doc_tags text[],
  score real
)
language plpgsql stable as $$
declare
  needle text;
begin
  needle := coalesce(nullif(trim(q), ''), '');

  return query
  with scored as (
    select
      e.id as entity_id,
      e.document_id,
      e.entity_type,
      e.title,
      e.summary,
      e.body,
      e.country_code,
      e.course_slug,
      e.school_name,
      e.city_or_region,
      e.currency_code,
      e.amount,
      e.amount_unit,
      e.valid_from,
      e.valid_to,
      e.ai_confidence,
      e.data,
      d.filename as doc_filename,
      d.mime_type as doc_mime_type,
      d.storage_path as doc_storage_path,
      d.title as doc_title,
      d.source_label as doc_source_label,
      d.tags as doc_tags,
      (
        case when p_country_code is not null and e.country_code = p_country_code then 0.35 else 0 end
        + case when p_course_slug is not null and e.course_slug = p_course_slug then 0.25 else 0 end
        + case when p_age_bracket is not null and e.age_bracket = p_age_bracket then 0.10 else 0 end
        + case
            when p_school_name is not null and e.school_name % p_school_name
            then 0.15 else 0
          end
        + case
            when p_city is not null and e.city_or_region % p_city
            then 0.10 else 0
          end
        + case
            when needle <> '' then
              greatest(
                similarity(coalesce(e.title, ''),   needle),
                similarity(coalesce(e.body, ''),    needle) * 0.8,
                similarity(coalesce(e.summary, ''), needle) * 0.6
              )
            else 0
          end
        + case
            when (e.valid_from is null or e.valid_from <= current_date)
             and (e.valid_to   is null or e.valid_to   >= current_date)
            then 0.05 else 0
          end
        + coalesce(e.ai_confidence, 0.5) * 0.05
      )::real as score
    from extracted_entities e
    join document_uploads d on d.id = e.document_id
    where d.status in ('analyzed', 'extracted')
  )
  select * from scored
  where score > 0.05
  order by score desc, entity_id
  limit greatest(1, p_limit);
end;
$$;

-- Permissive read for the service-role + authenticated clients (we run as
-- service-role server-side, so RLS is not enforced; this is purely for
-- future-proofing if RLS gets enabled).
alter table document_uploads enable row level security;
alter table document_chunks  enable row level security;
alter table extracted_entities enable row level security;
alter table knowledge_search_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_uploads' and policyname = 'doc_uploads_service_role_all'
  ) then
    create policy doc_uploads_service_role_all on document_uploads
      for all to public using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_chunks' and policyname = 'doc_chunks_service_role_all'
  ) then
    create policy doc_chunks_service_role_all on document_chunks
      for all to public using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'extracted_entities' and policyname = 'entities_service_role_all'
  ) then
    create policy entities_service_role_all on extracted_entities
      for all to public using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_search_log' and policyname = 'log_service_role_all'
  ) then
    create policy log_service_role_all on knowledge_search_log
      for all to public using (true) with check (true);
  end if;
end $$;
