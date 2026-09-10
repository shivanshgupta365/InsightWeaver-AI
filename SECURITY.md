# Security policy

Security updates target the latest public beta. Do not open public vulnerability issues; use GitHub Security Advisories and include reproduction, impact, and mitigation without real customer data or credentials.

- Guest files are processed locally and stored in browser IndexedDB.
- AI accepts at most 50 KB and rejects raw files and full row collections.
- Cloud data requires authentication, explicit grants, owner-only RLS, and owner-scoped paths.
- The browser receives only a Supabase publishable key. Gemini and Supabase secret keys remain server-side.

See `docs/PRIVACY.md` for the detailed data flow.
