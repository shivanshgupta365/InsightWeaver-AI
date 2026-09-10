# Deployment

Import this repository to Vercel as a Vite project. Configure preview and production separately: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and a random `AI_RATE_LIMIT_SALT`.

Create Supabase in Mumbai when available, otherwise Singapore. Link the CLI and run `supabase db push`. The migration creates tables, grants, RLS, and the private bucket. Verify with two test users.

From a clean browser: open a sample, upload a unique fixture, review mapping and quality, inspect the dashboard, accept the AI disclosure, download the ZIP, and compare normalized counts/values with the fixture. Verify `/api/health`, cross-user denial, and scheduled smoke checks.
