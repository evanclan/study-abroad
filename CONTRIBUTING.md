# Contributing to Study Abroad Support AI

Thank you for your interest in contributing! This project helps study-abroad
agencies stay on top of supplier pricing, campaigns, and program data — then
turn that knowledge into instant, cited quotes for counselors.

## Ways to contribute

You do not need permission to open an issue or draft a PR. Good first areas:

| Area | Where to look |
| --- | --- |
| **Upload parsers** | `src/lib/uploads/extract-text.ts` — new file types, better OCR fallbacks |
| **Entity extraction** | `src/lib/uploads/analyze-document.ts` — new entity types, prompt tuning |
| **Knowledge search** | `src/lib/uploads/search-knowledge.ts`, `search_knowledge()` RPC in migrations |
| **Quote orchestrator** | `src/lib/quote/orchestrator.ts` — pipeline phases, local vs live logic |
| **UI / UX** | `src/components/` — Upload Hub, quote board, knowledge citations |
| **Research agents** | `src/lib/research/` — schools, accommodation, location, activities |
| **Database** | `supabase/migrations/` — schema, indexes, seed data, new countries |
| **Tests & fixtures** | `test-data/` — sample supplier docs for regression testing |

## Development setup

1. **Fork & clone** the repo.
2. **Install dependencies:** `npm install`
3. **Copy env template:** `cp .env.local.example .env.local`
4. **Fill in keys** (your own — never commit `.env.local`):
   - Supabase URL + publishable/anon key + **service role key**
   - Anthropic API key
   - Firecrawl API key
5. **Apply migrations** — either `supabase start` locally, or point at a hosted
   Supabase project and run migrations from `supabase/migrations/`.
6. **Run the dev server:** `npm run dev` → http://localhost:3000

See [README.md](./README.md) for architecture details.

## Pull request guidelines

1. **One concern per PR** when possible (e.g. “add CSV entity tests” not “refactor
   everything”).
2. **No secrets** — `.env.local`, API keys, service-role JWTs, or real supplier
   PDFs with private pricing must not appear in commits.
3. **Match existing style** — TypeScript strict, Zod at IO boundaries, shared
   types in `src/types/quote.ts`.
4. **Schema changes** — add a new numbered file under `supabase/migrations/`,
   update `src/lib/supabase/database.types.ts`, note the change in the PR body.
5. **Describe the why** — what counselor or agency problem does this solve?

## Reporting bugs

Open a [GitHub issue](https://github.com/evanclan/study-abroad/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (redact API keys)
- Sample prompt or upload file if applicable (use `test-data/` style mocks)

## Code of conduct

Be respectful and constructive. This tool supports real counselors helping students
study abroad — keep discussions professional and inclusive.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
