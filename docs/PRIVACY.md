# Privacy model

## Guest mode

Source files, rows, mappings, dashboards, and exports remain in the browser. Projects are stored in IndexedDB. Clearing site data removes them.

## Optional AI

AI is off until the user accepts a per-session disclosure. It receives schema profiles, aggregates, findings, and workflow trace. Sample rows are off by default and capped at five explicitly redacted rows. The Gemini free tier may use submitted context to improve Google products. A deterministic fallback remains available.

## Optional cloud

Cloud sync requires passwordless authentication and explicit disclosure. Version 1 uses private owner-only Supabase storage and does not claim end-to-end encryption. AI telemetry is restricted to an actor hash, timing, category, status, and token counts—never prompts or financial content.
