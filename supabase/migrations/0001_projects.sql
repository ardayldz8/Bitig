-- Bitig — Projelerim şeması
-- Tüm kullanıcı tabloları RLS ile korunur; kullanıcı yalnızca kendi kayıtlarını görür.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- GitHub App

create table if not exists public.github_installations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login   text not null,
  account_type    text not null default 'User',
  created_at      timestamptz not null default now()
);

create index if not exists github_installations_user_idx
  on public.github_installations(user_id);

-- ---------------------------------------------------------------- Projeler

create table if not exists public.projects (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  name                   text not null check (length(trim(name)) > 0),
  description            text,
  status                 text not null default 'active'
                           check (status in ('active','on_hold','completed','archived')),
  repository_id          uuid,
  github_full_name       text,
  github_default_branch  text,
  technologies           text[] not null default '{}',
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists projects_repo_idx on public.projects(github_full_name);

-- ---------------------------------------------------------------- Bitig verisi

create table if not exists public.project_features (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  title                text not null check (length(trim(title)) > 0),
  description          text,
  status               text not null default 'planned'
                         check (status in ('planned','in_progress','completed','blocked','on_hold')),
  priority             text not null default 'medium'
                         check (priority in ('low','medium','high','critical')),
  acceptance_criteria  text[] not null default '{}',
  github_issue_number  integer,
  github_issue_url     text,
  target_date          date,
  completed_at         timestamptz,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists project_features_project_idx
  on public.project_features(project_id, position);

create table if not exists public.project_notes (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  title              text not null check (length(trim(title)) > 0),
  content            text not null default '',
  related_feature_id uuid references public.project_features(id) on delete set null,
  tags               text[] not null default '{}',
  pinned             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists project_notes_project_idx on public.project_notes(project_id);

create table if not exists public.project_tasks (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  title               text not null check (length(trim(title)) > 0),
  description         text,
  completed           boolean not null default false,
  priority            text not null default 'medium'
                        check (priority in ('low','medium','high','critical')),
  related_feature_id  uuid references public.project_features(id) on delete set null,
  github_issue_number integer,
  due_date            date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on public.project_tasks(project_id);

create table if not exists public.project_activities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  source       text not null check (source in ('github','bitig','ai')),
  type         text not null,
  title        text not null,
  description  text,
  external_url text,
  occurred_at  timestamptz not null default now()
);

create index if not exists project_activities_project_idx
  on public.project_activities(project_id, occurred_at desc);

-- ---------------------------------------------------------------- GitHub önbelleği
-- Tüm payload saklanmaz; yalnızca normalize edilmiş, gerekli alanlar tutulur.

create table if not exists public.github_repositories (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  repository_id  bigint not null,
  full_name      text not null,
  name           text not null,
  description    text,
  is_private     boolean not null default false,
  default_branch text not null default 'main',
  html_url       text not null,
  language       text,
  languages      jsonb not null default '{}',
  branch_count   integer,
  readme         text,
  updated_at     timestamptz not null default now(),
  unique (project_id, repository_id)
);

create table if not exists public.github_commits (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  sha           text not null,
  message       text not null,
  author_name   text,
  author_login  text,
  branch        text,
  html_url      text,
  committed_at  timestamptz not null,
  unique (project_id, sha)
);

create index if not exists github_commits_project_idx
  on public.github_commits(project_id, committed_at desc);

create table if not exists public.github_pull_requests (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  number        integer not null,
  title         text not null,
  state         text not null,
  merged        boolean not null default false,
  draft         boolean not null default false,
  author_login  text,
  review_state  text,
  checks_state  text,
  html_url      text,
  created_at    timestamptz not null,
  unique (project_id, number)
);

create table if not exists public.github_issues (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  number         integer not null,
  title          text not null,
  state          text not null,
  labels         text[] not null default '{}',
  assignee_login text,
  html_url       text,
  created_at     timestamptz not null,
  unique (project_id, number)
);

create table if not exists public.github_workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  run_id       bigint not null,
  name         text not null,
  branch       text,
  head_sha     text,
  status       text not null,
  conclusion   text,
  started_at   timestamptz,
  completed_at timestamptz,
  html_url     text,
  unique (project_id, run_id)
);

create table if not exists public.github_releases (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  tag_name     text not null,
  name         text,
  published_at timestamptz,
  draft        boolean not null default false,
  prerelease   boolean not null default false,
  html_url     text,
  unique (project_id, tag_name)
);

-- Aynı webhook iki kez işlenmesin: delivery id UNIQUE
create table if not exists public.github_webhook_deliveries (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  text not null unique,
  event        text not null,
  received_at  timestamptz not null default now()
);

create table if not exists public.github_sync_states (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade unique,
  last_synced_at timestamptz,
  last_status   text,
  last_error    text
);

create table if not exists public.ai_project_snapshots (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_project_snapshots_project_idx
  on public.ai_project_snapshots(project_id, created_at desc);

-- ---------------------------------------------------------------- RLS

alter table public.github_installations      enable row level security;
alter table public.projects                  enable row level security;
alter table public.project_features          enable row level security;
alter table public.project_notes             enable row level security;
alter table public.project_tasks             enable row level security;
alter table public.project_activities        enable row level security;
alter table public.github_repositories       enable row level security;
alter table public.github_commits            enable row level security;
alter table public.github_pull_requests      enable row level security;
alter table public.github_issues             enable row level security;
alter table public.github_workflow_runs      enable row level security;
alter table public.github_releases           enable row level security;
alter table public.github_sync_states        enable row level security;
alter table public.ai_project_snapshots      enable row level security;
alter table public.github_webhook_deliveries enable row level security;

-- Kullanıcı yalnızca kendi installation kayıtlarını yönetir
drop policy if exists github_installations_owner on public.github_installations;
create policy github_installations_owner on public.github_installations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kullanıcı yalnızca kendi projelerini yönetir
drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Alt tablolar: proje sahipliği üzerinden erişim
do $$
declare
  child text;
begin
  foreach child in array array[
    'project_features','project_notes','project_tasks','project_activities',
    'github_repositories','github_commits','github_pull_requests','github_issues',
    'github_workflow_runs','github_releases','github_sync_states','ai_project_snapshots'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I', child, child);
    execute format($f$
      create policy %I_owner on public.%I
        for all
        using (exists (
          select 1 from public.projects p
          where p.id = %I.project_id and p.user_id = auth.uid()
        ))
        with check (exists (
          select 1 from public.projects p
          where p.id = %I.project_id and p.user_id = auth.uid()
        ))
    $f$, child, child, child, child);
  end loop;
end $$;

-- Webhook delivery kaydı yalnızca service role tarafından yazılır.
-- Hiçbir kullanıcı politikası tanımlanmaz → anon/authenticated erişemez.

-- ---------------------------------------------------------------- Realtime

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_activities;
alter publication supabase_realtime add table public.github_commits;
alter publication supabase_realtime add table public.github_pull_requests;
alter publication supabase_realtime add table public.github_issues;
alter publication supabase_realtime add table public.github_workflow_runs;
