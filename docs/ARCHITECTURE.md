# Architecture

InsightWeaver is a static React/Vite PWA plus narrowly scoped Vercel Functions.

The browser owns source data. A module Web Worker parses CSV, XLSX, and JSON and runs inference, normalization, exact deduplication, validation, aggregation, and checksumming. IndexedDB persists guest projects. Artifact generation zips deterministic files in-browser.

`POST /api/ai/analyze` accepts only consented `AnalysisContext`, rejects raw/full rows, enforces 50 KB, calls Gemini with structured output, validates it with Zod, and rejects invented evidence references. `GET /api/health` exposes readiness booleans without secrets. `POST /api/projects/delete` validates an access token and owner scope before idempotently removing cloud objects and records.

Supabase is optional. Authenticated browser requests use a publishable key constrained by explicit grants and owner-only RLS. The private bucket path is `{user_id}/{project_id}/{run_id}/{artifact_name}`.
