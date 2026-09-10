-- InsightWeaver v1 owner-sc interfered data model.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  schema_version integer not null default 1 check (schema_version > 0),
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  status text not null default 'complete' check (status in ('processing','complete','failed')),
  row_count integer not null default 0 check (row_count between 0 and 100000),
  column_count integer not null default 0 check (column_count between 0 and 200),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name in ('normalized.csv','schema.json','validation.json','dashboard.json','report.json','workflow.json','executive-brief.md','manifest.json')),
  storage_path text not null,
  media_type text not null,
  byte_size integer not null check (byte_size between 0 and 26214400),
  created_at timestamptz not null default now(),
  unique(run_id,name)
);
create table public.workflow_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  schema_version integer not null default 1,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_usage (
  id bigint generated always as identity primary key,
  actor_hash text not null check (char_length(actor_hash) = 64),
  owner_id uuid references auth.users(id) on delete set null,
  request_category text not null,
  status integer not null,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects(owner_id,updated_at desc);
create index runs_owner_project_idx on public.runs(owner_id,project_id,created_at desc);
create index artifacts_owner_run_idx on public.artifacts(owner_id,run_id);
create index workflow_recipes_owner_idx on public.workflow_recipes(owner_id,updated_at desc);
create index ai_usage_actor_created_idx on public.ai_usage(actor_hash,created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.runs enable row level security;
alter table public.artifacts enable row level security;
alter table public.workflow_recipes enable row level security;
alter table public.ai_usage enable row level security;

revoke all on public.profiles,public.projects,public.runs,public.artifacts,public.workflow_recipes,public.ai_usage from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.projects,public.runs,public.artifacts,public.workflow_recipes to authenticated;

create policy "profiles_owner_select" on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy "profiles_owner_insert" on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy "profiles_owner_update" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "profiles_owner_delete" on public.profiles for delete to authenticated using ((select auth.uid())=id);

create policy "projects_owner_select" on public.projects for select to authenticated using ((select auth.uid())=owner_id);
create policy "projects_owner_insert" on public.projects for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "projects_owner_update" on public.projects for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "projects_owner_delete" on public.projects for delete to authenticated using ((select auth.uid())=owner_id);

create policy "runs_owner_select" on public.runs for select to authenticated using ((select auth.uid())=owner_id);
create policy "runs_owner_insert" on public.runs for insert to authenticated with check ((select auth.uid())=owner_id and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy "runs_owner_update" on public.runs for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "runs_owner_delete" on public.runs for delete to authenticated using ((select auth.uid())=owner_id);

create policy "artifacts_owner_select" on public.artifacts for select to authenticated using ((select auth.uid())=owner_id);
create policy "artifacts_owner_insert" on public.artifacts for insert to authenticated with check ((select auth.uid())=owner_id and storage_path like (select auth.uid())::text||'/%');
create policy "artifacts_owner_update" on public.artifacts for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and storage_path like (select auth.uid())::text||'/%');
create policy "artifacts_owner_delete" on public.artifacts for delete to authenticated using ((select auth.uid())=owner_id);

create policy "recipes_owner_select" on public.workflow_recipes for select to authenticated using ((select auth.uid())=owner_id);
create policy "recipes_owner_insert" on public.workflow_recipes for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "recipes_owner_update" on public.workflow_recipes for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "recipes_owner_delete" on public.workflow_recipes for delete to authenticated using ((select auth.uid())=owner_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('project-files','project-files',false,26214400,array['text/csv','application/json','text/markdown','application/zip'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "project_files_owner_select" on storage.objects for select to authenticated using (bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "project_files_owner_insert" on storage.objects for insert to authenticated with check (bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "project_files_owner_update" on storage.objects for update to authenticated using (bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "project_files_owner_delete" on storage.objects for delete to authenticated using (bucket_id='project-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
