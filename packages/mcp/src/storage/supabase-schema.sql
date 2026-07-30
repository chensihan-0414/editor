-- Run this once in your Supabase project's SQL Editor before deploying.
-- Mirrors the SQLite schema in sqlite-scene-store.ts, translated to Postgres.

create table if not exists scenes (
  id text primary key,
  name text not null check (char_length(name) between 1 and 200),
  project_id text,
  owner_id text,
  thumbnail_url text,
  version integer not null check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  size_bytes integer not null check (size_bytes >= 0),
  node_count integer not null check (node_count >= 0),
  graph_json jsonb not null
);

create index if not exists scenes_project_updated_idx on scenes (project_id, updated_at desc);
create index if not exists scenes_owner_updated_idx on scenes (owner_id, updated_at desc);

create table if not exists scene_revisions (
  scene_id text not null references scenes (id) on delete cascade,
  version integer not null check (version >= 1),
  graph_json jsonb not null,
  author_kind text not null,
  author_id text,
  created_at timestamptz not null default now(),
  primary key (scene_id, version)
);

create table if not exists scene_events (
  event_id bigserial primary key,
  scene_id text not null references scenes (id) on delete cascade,
  version integer not null check (version >= 1),
  kind text not null,
  created_at timestamptz not null default now(),
  graph_json jsonb not null
);

create index if not exists scene_events_scene_event_idx on scene_events (scene_id, event_id);

-- This app talks to Supabase using the service_role key from a trusted
-- server context only (Vercel serverless functions), never from the
-- browser — so Row Level Security can stay off for these tables. If you
-- ever call Supabase directly from client-side code instead, enable RLS
-- and add policies before doing that.
