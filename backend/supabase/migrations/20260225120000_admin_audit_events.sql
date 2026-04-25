-- Admin action history for review timeline (approve/reject verification, revoke/grant verified, block/restore access).
create extension if not exists pgcrypto;

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  target_type text not null check (target_type in ('verification_request', 'trainer', 'profile')),
  target_id uuid not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_events_created_at on public.admin_audit_events (created_at desc);
create index if not exists idx_admin_audit_events_target on public.admin_audit_events (target_type, target_id);

comment on table public.admin_audit_events is 'Append-only log of admin actions for the admin review history UI.';
