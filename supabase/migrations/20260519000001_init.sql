-- Kaeru Quote Engine: initial schema
-- Cache-first AI-augmented quote engine for the かえる留学 agency.

create extension if not exists "pgcrypto";

-- =============================================================================
-- Reference tables
-- =============================================================================

create table if not exists countries (
  code text primary key,
  name_ja text not null,
  name_en text not null,
  currency_code text not null
);

create table if not exists course_types (
  slug text primary key,
  name_ja text not null,
  name_en text not null
);

create table if not exists schools (
  id uuid primary key default gen_random_uuid (),
  country_code text not null references countries (code) on delete cascade,
  name text not null,
  source_url text,
  created_at timestamptz not null default now (),
  unique (country_code, name)
);

-- =============================================================================
-- Quote cache (the heart of the cache-first strategy)
-- =============================================================================

create table if not exists quote_cache (
  id uuid primary key default gen_random_uuid (),
  country_code text not null references countries (code) on delete cascade,
  course_slug text not null references course_types (slug) on delete cascade,
  age_bracket text not null,
  duration_months int not null,
  school_id uuid references schools (id) on delete set null,
  school_name text,
  source_url text,

  -- Raw costs are persisted in the source currency for fidelity.
  currency_code text not null,
  tuition numeric(12, 2) not null default 0,
  accommodation numeric(12, 2) not null default 0,
  registration numeric(12, 2) not null default 0,
  other_fees numeric(12, 2) not null default 0,
  total numeric(12, 2) generated always as (
    tuition + accommodation + registration + other_fees
  ) stored,

  -- Cached AI output so repeat lookups do not re-bill tokens.
  ai_summary_ja text,
  ai_suggestions_ja jsonb,

  -- Raw firecrawl payload retained for debugging / re-extraction.
  raw_extraction jsonb,

  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),

  unique (country_code, course_slug, age_bracket, duration_months, school_id)
);

create index if not exists quote_cache_lookup_idx
  on quote_cache (country_code, course_slug, age_bracket, duration_months, updated_at desc);

-- =============================================================================
-- FX rates (daily refresh, keyed by base/quote)
-- =============================================================================

create table if not exists fx_rates (
  base text not null,
  quote text not null,
  rate numeric(18, 8) not null,
  fetched_at timestamptz not null default now (),
  primary key (base, quote)
);

-- =============================================================================
-- Search history (powers the recent-quotes rail)
-- =============================================================================

create table if not exists quote_history (
  id uuid primary key default gen_random_uuid (),
  prompt_text text not null,
  parsed_params jsonb not null,
  result_quote_id uuid references quote_cache (id) on delete set null,
  source text not null check (source in ('local', 'live_search')),
  duration_ms int,
  created_at timestamptz not null default now ()
);

create index if not exists quote_history_recent_idx on quote_history (created_at desc);

-- =============================================================================
-- updated_at trigger for quote_cache
-- =============================================================================

create or replace function set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_quote_cache_updated_at on quote_cache;
create trigger trg_quote_cache_updated_at
  before update on quote_cache
  for each row execute function set_updated_at ();
