-- Temporary coordination state for Objective 4 SmartBoard/iPad sessions.
-- No child identity, teacher observations, notes, media, or GOLD level is stored here.
create table if not exists public.little_evidence_movement_sessions (
  id uuid primary key,
  teacher_token_hash text not null,
  display_token_hash text not null,
  prompt_index integer not null default 0 check (prompt_index between 0 and 2),
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'active', 'done', 'complete')),
  display_done boolean not null default false,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.little_evidence_movement_sessions enable row level security;
revoke all on table public.little_evidence_movement_sessions from public, anon, authenticated;
