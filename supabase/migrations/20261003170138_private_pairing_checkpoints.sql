-- Account-protected, immutable checkpoint handoff for an activity pairing.
-- Child/checkpoint/account identifiers never enter the public relay or QR URL.
create table public.little_evidence_pairing_checkpoints (
  pairing_id uuid primary key references public.little_evidence_activity_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkpoint_id uuid not null references public.little_evidence_checkpoints(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.little_evidence_pairing_checkpoints enable row level security;
alter table public.little_evidence_pairing_checkpoints force row level security;

-- Remove inherited/default grants as well as explicit access. No relay or
-- existing child/checkpoint table grants or policies are changed here.
revoke all privileges on table public.little_evidence_pairing_checkpoints from public, anon, authenticated, service_role;
grant select, insert on table public.little_evidence_pairing_checkpoints to authenticated;

create index little_evidence_pairing_checkpoints_owner_idx
  on public.little_evidence_pairing_checkpoints(owner_id);
create index little_evidence_pairing_checkpoints_checkpoint_idx
  on public.little_evidence_pairing_checkpoints(checkpoint_id);

create policy "owners read unexpired pairing checkpoints"
  on public.little_evidence_pairing_checkpoints for select to authenticated
  using (
    owner_id = (select auth.uid())
    and expires_at > now()
    and exists (
      select 1 from public.little_evidence_checkpoints cp
      where cp.id = little_evidence_pairing_checkpoints.checkpoint_id
        and cp.owner_id = (select auth.uid())
    )
  );

create policy "owners create bounded pairing checkpoints"
  on public.little_evidence_pairing_checkpoints for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and expires_at > now()
    and expires_at <= now() + interval '2 hours'
    and exists (
      select 1 from public.little_evidence_checkpoints cp
      where cp.id = little_evidence_pairing_checkpoints.checkpoint_id
        and cp.owner_id = (select auth.uid())
    )
  );
