-- Customer support ticket workflow for users and admins.
create extension if not exists pgcrypto;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references public.profiles (id) on delete restrict,
  assigned_admin_user_id uuid references public.profiles (id) on delete set null,
  category text not null default 'other' check (category in ('booking', 'payment', 'verification', 'account', 'technical', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  subject text not null,
  description text not null,
  resolution_note text,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null check (event_type in ('created', 'status_changed', 'assigned', 'comment', 'priority_changed', 'closed', 'reopened')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_status_created_at on public.support_tickets (status, created_at desc);
create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by_user_id, created_at desc);
create index if not exists idx_support_tickets_assigned_admin on public.support_tickets (assigned_admin_user_id, status, created_at desc);
create index if not exists idx_support_ticket_events_ticket_created_at on public.support_ticket_events (ticket_id, created_at asc);

create or replace function public.set_support_tickets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row
execute function public.set_support_tickets_updated_at();

comment on table public.support_tickets is 'Support tickets raised by users and triaged by admins.';
comment on table public.support_ticket_events is 'Append-only support ticket timeline events.';
