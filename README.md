# Study Abroad Support AI

**An AI-augmented quote & knowledge engine for study-abroad agencies.**

Helps counselors answer “how much does this program cost?” in seconds — using
**your own supplier documents first**, then cached data, then live web research
only when local knowledge is not enough.

Built for [かえる留学](https://github.com/evanclan/study-abroad) and **open for
contributions**. See [CONTRIBUTING.md](./CONTRIBUTING.md).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## What problem does this solve?

Study-abroad agencies receive a constant stream of supplier updates: PDF price
lists, Word campaign briefs, Excel fee tables, scanned brochures, and ad-hoc
emails. Counselors need to quote accurately and cite their sources — but the
data is scattered and goes stale fast.

This app turns that chaos into a **searchable knowledge base** and a **quote
engine** that counselors use from one dashboard.

## What it does

### 1. Upload Hub — ingest supplier knowledge

Drop any file into the dashboard:

- PDF, Word, Excel, CSV, Markdown, JSON, images (PNG/JPG/WebP)

The pipeline:

1. Stores the original in Supabase Storage (deduped by content hash)
2. Extracts text (`unpdf`, `mammoth`, `xlsx`, or Claude Vision for images)
3. Runs Claude to pull out structured **entities**: schools, prices, campaigns,
   accommodations, rules, contacts, locations, visa info, and more
4. Saves everything to Postgres so it is searchable and citable

Example: upload a Cebu language-school price list → the system learns tuition
tiers, room types, campaign dates, and registration fees as individual atoms.

### 2. Quote Engine — natural-language quotes with citations

Counselors type a prompt in Japanese, English, or mixed, e.g.:

```text
26歳女性、フィリピンセブ、ビーチ近くの語学学校、4週間、英語コース、1人部屋希望、予算¥150,000
```

The engine:

1. **Parses** the prompt into structured parameters (country, course, age,
   duration, budget, preferences)
2. **Searches local knowledge** — uploaded PDFs/Word files via `search_knowledge()`
3. **Checks the quote cache** — previously scraped or computed quotes (< 30 days)
4. **Falls back to live research** only if local data is insufficient — Firecrawl
   scrapes school pages, parallel agents find schools, accommodation, location,
   and activities
5. **Streams results** to a Kanban-style UI with costs, budget fit, AI advice
   in Japanese, and **links back to source documents**

Every result is tagged **LOCAL** (from your database / uploads) or **LIVE**
(from web research).

## Data priority (local first)

```
Upload Hub documents  →  strongest (your supplier PDFs, with citations)
        ↓
Quote cache           →  recent scraped/computed quotes (< 30 days)
        ↓
Live web search       →  only when local knowledge is not enough
```

This keeps quotes fast, cheap (fewer API calls), and traceable to real supplier
materials.

## Who is this for?

- **Study-abroad agencies** managing multi-country supplier networks
- **Counselors** who quote in natural language and need source citations
- **Developers** who want to extend AI document ingestion, search, or quote logic

Currently single-tenant (no auth layer). Add Supabase Auth before exposing
to the public internet.

## Contributing

Contributions are welcome! Whether you want to:

- Add support for new document formats
- Improve entity extraction for a country or supplier type
- Tune knowledge search / quote matching
- Build UI for counselors
- Add tests and sample data

Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup and PR guidelines.

**Quick start for contributors:**

```bash
git clone https://github.com/evanclan/study-abroad.git
cd study-abroad
npm install
cp .env.local.example .env.local
# Add your Supabase, Anthropic, and Firecrawl keys to .env.local
npm run dev
```

Open an issue or PR on [GitHub](https://github.com/evanclan/study-abroad).

---

## Architecture at a glance

```
prompt
  │
  ▼
[parse] Claude tool-use ─────────► QuoteParams
  │
  ├──► [knowledge-lookup] search_knowledge() RPC
  │         ├─ sufficient ──► render LOCAL with PDF/Word source citations
  │         └─ partial    ──► forward as context to live pipeline
  ▼
[cache-lookup] Supabase ───┬──► fresh (<30d) ──► render LOCAL
                           │
                           └──► miss / stale ──► [Firecrawl scrape]
                                                 ──► [extract] Claude tool-use
                                                 ──► [fx] JPY conversion
                                                 ──► [insights] Claude stream
                                                 ──► [upsert] write-back
                                                 ──► render LIVE_SEARCH

Upload Hub
  │
  ▼ multipart POST /api/uploads
[storage] Supabase Storage  (private `documents` bucket)
  │
  ▼
[extract-text] unpdf / mammoth / xlsx / Claude Vision OCR / utf-8
  │
  ▼
[analyze-document] Claude tool-use ─────────► AnalyzedEntity[]
  │
  ▼
[persist] document_uploads · document_chunks · extracted_entities · schools
```

Every phase is emitted to the client as a typed Server-Sent Event so the four
columns light up progressively rather than blocking on a single response.

## Tech stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Tailwind CSS v4**
- **Framer Motion / `motion`** for the horizontal stagger and AI typewriter
- **Supabase** Postgres + Storage (local via `supabase start` or hosted)
- **Anthropic Claude sonnet-4-5** for query parsing, cost extraction, image
  OCR, document-to-entity analysis, and Japanese insights (tool-use + vision
  + streaming)
- **unpdf · mammoth · xlsx** for PDF / Word / Excel / CSV text extraction
- **Firecrawl** HTTP API for live school-page scraping
- **pg_trgm** Postgres extension for mixed-language fuzzy search
- **Zod** for runtime validation at every IO boundary

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the local Supabase stack**

   Requires Docker to be running.

   ```bash
   supabase start
   ```

   The CLI prints the local URL plus the anon / service-role keys. Copy them
   into `.env.local` (see `.env.local.example`). Migrations under
   `supabase/migrations/` apply automatically on first start.

3. **Set API keys**

   ```bash
   cp .env.local.example .env.local
   # edit .env.local and add ANTHROPIC_API_KEY + FIRECRAWL_API_KEY
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000.

5. **Regenerate Supabase types (optional)**

   After schema changes:

   ```bash
   supabase gen types typescript --local > src/lib/supabase/database.types.ts
   ```

## Project layout

```
src/
├─ app/
│  ├─ api/quote/route.ts            # SSE orchestration endpoint
│  ├─ api/history/route.ts          # Recent-quotes feed
│  ├─ api/uploads/route.ts          # POST: ingest files, GET: list documents
│  ├─ api/uploads/[id]/route.ts     # GET document detail, DELETE document
│  ├─ layout.tsx                    # JP + Inter fonts, dark theme
│  └─ page.tsx                      # Server shell + AppShell tabs
├─ components/
│  ├─ ui/                           # Pure atoms (Badge, MetricCard, IconPill, ...)
│  ├─ columns/                      # The 4 Kanban columns
│  ├─ sections/                     # Schools / accommodation / location / etc.
│  │  └─ knowledge-matches-panel.tsx  # Local source citations in a quote
│  ├─ app-shell.tsx                 # Tab nav between Quote Engine & Upload Hub
│  ├─ upload-hub.tsx                # Drag-drop hub + document table
│  ├─ dashboard-board.tsx           # Motion stagger + status bar
│  ├─ quote-input.tsx               # cmd+K search input
│  ├─ quote-workspace.tsx           # Orchestrates input <-> board <-> rail
│  └─ recent-quotes-rail.tsx        # Right rail with search history
├─ hooks/
│  ├─ use-quote-stream.ts           # SSE reducer / state machine
│  ├─ use-recent-quotes.ts
│  └─ use-upload-hub.ts             # Multipart upload + document refresh
├─ lib/
│  ├─ ai/                           # Anthropic clients (parse, extract, insights)
│  ├─ firecrawl/                    # Scrape adapter
│  ├─ fx/                           # JPY conversion with cache + offline fallback
│  ├─ quote/                        # Cache lookup, upsert, age-bracket, orchestrator
│  ├─ uploads/                      # Knowledge Hub: extract → analyze → ingest → search
│  ├─ supabase/                     # Typed client + Database type definitions
│  └─ utils/                        # cn(), currency formatters
└─ types/quote.ts                   # Shared contracts: QuoteParams, StreamEvent, ...
supabase/
├─ migrations/
│  ├─ 20260519000001_init.sql           # quote_cache · schools · history
│  ├─ 20260519000002_seed.sql           # reference data
│  ├─ 20260522000001_knowledge_hub.sql  # document_uploads · entities · chunks · search RPC
│  └─ 20260522000002_storage_bucket.sql # private `documents` bucket
└─ config.toml
```

## Upload Hub workflow

1. Drop any file (PDF, DOCX, XLSX, CSV, PNG, JPG, TXT, MD, JSON) onto the
   Upload Hub tab. Each file is hashed (SHA-256) and stored in the private
   `documents` Supabase Storage bucket. Duplicate uploads are deduped by hash.
2. The pipeline routes the bytes through the right extractor:
   `unpdf` for PDF, `mammoth` for DOCX, `xlsx` for Excel, `Claude Vision`
   for images, plain decoder for text.
3. The extracted text is fed to Claude with the
   `submit_document_analysis` tool. Claude returns:
   - a short Japanese summary
   - a keyword bag (used for search reranking)
   - country / course / school / city scope hints
   - validity dates (for campaigns and seasonal prices)
   - a list of **typed entities** (`school`, `price`, `campaign`,
     `accommodation`, `rule`, `contact`, `location`, `program`, `visa`,
     `insurance`, `flight`, `activity`, `note`, …).
4. Each entity is written to `extracted_entities` with denormalized columns
   so the matcher can filter by country/course/age. The full text is split
   into `document_chunks` for chunk-level display.
5. When a counselor submits a quote prompt, the orchestrator first calls
   `search_knowledge()` (a Postgres RPC backed by `pg_trgm` similarity +
   scoped equality bonuses). If the local hits are strong enough, the
   quote renders in `LOCAL` mode with source-PDF citations and skips the
   live web research entirely. Otherwise, knowledge matches are merged
   into the references panel and the live pipeline supplements them.

## Customising

- **Add a country:** insert a row into `countries` plus update the
  `SUPPORTED_COUNTRIES` const in `src/types/quote.ts` and the labels map.
- **Tune freshness:** edit `FRESHNESS_DAYS` in
  `src/lib/quote/cache-lookup.ts` (default 30).
- **Tune knowledge sufficiency thresholds:** edit
  `STRONG_MATCH_THRESHOLD` and `MIN_STRONG_MATCHES` in
  `src/lib/uploads/search-knowledge.ts`.
- **Swap the LLM:** every Claude call goes through
  `src/lib/ai/anthropic-client.ts` (single source of truth for the model
  name). To run a comparison test, point that file at a different model.
- **Add a new entity type:** add it to the `entity_type` CHECK constraint
  in `20260522000001_knowledge_hub.sql`, mirror it in the
  `ENTITY_TYPES` const in `src/lib/uploads/analyze-document.ts`, and add
  a label + color in `src/components/sections/knowledge-matches-panel.tsx`.

## Notes

- This is an **internal** single-tenant tool. There is no auth layer (yet).
  Add Supabase Auth before exposing publicly.
- The orchestrator returns a stale cache row as a graceful fallback when
  Firecrawl fails — the row is still flagged as `local`, but the timestamp
  tells the counselor it's stale.
- AI insights are cached alongside the costs so repeat queries do **not**
  re-bill tokens.
- Document analysis is idempotent on `content_hash`; re-uploading the
  same file is a no-op. The full pipeline re-runs only if the row is in
  `failed` status or its hash changes.
